"""Break-Glass access service.

Enforces:
- Single-patient scope per request
- Password re-verification
- Abuse detection: >3 distinct patients within 30 min → auto-suspend doctor
- No download permission for emergency sessions
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
import bcrypt

from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from fastapi import HTTPException

from models.break_glass import BreakGlassRequest, BreakGlassAction, BreakGlassSuspensionEvent, BreakGlassStatus
from models.user import User, UserStatus, UserRole
from models.notification import Notification, NotificationType
from models.audit import AuditLog
from models.access_event import RecordAccessEvent
from schemas.break_glass import BreakGlassRequestCreate, RestoreFromSuspensionRequest

BREAK_GLASS_DURATION_HOURS = 4
ABUSE_WINDOW_MINUTES = 30
ABUSE_MAX_DISTINCT_PATIENTS = 3  # 4th triggers suspension


def _notify(db: Session, recipient_id: int, title: str, message: str, ntype: NotificationType) -> None:
    db.add(Notification(recipient_id=recipient_id, title=title, message=message, type=ntype))


def _audit(db: Session, actor_id: int | None, action: str, target_type: str | None = None,
           target_id: int | None = None, details: dict | None = None, ip: str | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target_type=target_type,
                    target_id=target_id, details=details, ip_address=ip))


def _get_all_admin_ids(db: Session) -> list[int]:
    return [u.id for u in db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE).all()]


# ── Core request ───────────────────────────────────────────────────────────────

def request_break_glass(db: Session, data: BreakGlassRequestCreate, doctor: User,
                        ip: str | None = None) -> BreakGlassRequest:
    """Create a Break-Glass request for exactly one patient."""
    # 1. Doctor must be ACTIVE
    if doctor.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Your account is not active.")

    # 2. Verify password
    if not bcrypt.checkpw(data.password.encode(), doctor.password_hash.encode()):
        _audit(db, doctor.id, "BREAK_GLASS_PASSWORD_FAILED", "User", doctor.id, ip=ip)
        db.commit()
        raise HTTPException(status_code=401, detail="Password incorrect. Break-Glass denied.")

    # 3. Patient must exist and be a PATIENT
    patient = db.query(User).filter(User.id == data.patient_id, User.role == UserRole.PATIENT).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # 4. Check abuse: distinct patients in last 30 min
    window_start = datetime.now(timezone.utc) - timedelta(minutes=ABUSE_WINDOW_MINUTES)
    # Count distinct patients in active/expired requests (not counting same patient again)
    distinct_patients = (
        db.query(func.count(distinct(BreakGlassRequest.patient_id)))
        .filter(
            BreakGlassRequest.doctor_id == doctor.id,
            BreakGlassRequest.granted_at >= window_start,
            BreakGlassRequest.patient_id != data.patient_id,
        )
        .scalar() or 0
    )
    # This patient counts as 1 more
    total_distinct = distinct_patients + 1
    if total_distinct > ABUSE_MAX_DISTINCT_PATIENTS:
        _trigger_abuse_suspension(db, doctor, data.patient_id, window_start, ip)
        db.commit()
        raise HTTPException(status_code=403, detail="Break-Glass abuse detected. Account suspended.")

    # 5. Create request
    expires = datetime.now(timezone.utc) + timedelta(hours=BREAK_GLASS_DURATION_HOURS)
    req = BreakGlassRequest(
        doctor_id=doctor.id,
        patient_id=patient.id,
        justification=data.justification,
        status=BreakGlassStatus.ACTIVE,
        expires_at=expires,
    )
    db.add(req)
    db.flush()  # get req.id

    # 6. Audit + notify
    _audit(db, doctor.id, "BREAK_GLASS_REQUESTED", "BreakGlassRequest", req.id,
           {"patient_id": patient.id, "justification": data.justification, "expires_at": expires.isoformat()}, ip=ip)

    # Notify all admins
    for admin_id in _get_all_admin_ids(db):
        _notify(db, admin_id,
                "🚨 Break-Glass Access",
                f"Dr. {doctor.name} requested emergency access to {patient.name}'s records. Justification: {data.justification[:100]}",
                NotificationType.BREAK_GLASS_REQUEST)

    # Notify patient
    _notify(db, patient.id,
            "🚨 Emergency Access to Your Records",
            f"Dr. {doctor.name} has been granted emergency access to your medical records. Reason: {data.justification[:100]}",
            NotificationType.BREAK_GLASS_REQUEST)

    db.commit()
    return req


def _trigger_abuse_suspension(db: Session, doctor: User, new_patient_id: int,
                               window_start: datetime, ip: str | None) -> None:
    """Auto-suspend doctor for Break-Glass abuse."""
    # Collect patient IDs in window (including the new one)
    existing_ids = [
        row[0] for row in db.query(distinct(BreakGlassRequest.patient_id))
        .filter(BreakGlassRequest.doctor_id == doctor.id, BreakGlassRequest.granted_at >= window_start)
        .all()
    ]
    all_patient_ids = list(set(existing_ids + [new_patient_id]))

    # Suspend doctor
    doctor.status = UserStatus.SUSPENDED
    doctor.suspension_reason = "Automatic suspension: Break-Glass abuse (>3 patients in 30-min window)"
    doctor.suspended_at = datetime.now(timezone.utc)

    # Record suspension event
    event = BreakGlassSuspensionEvent(
        doctor_id=doctor.id,
        trigger_count=len(all_patient_ids),
        window_start=window_start,
        window_end=datetime.now(timezone.utc),
        patient_ids=all_patient_ids,
    )
    db.add(event)

    _audit(db, None, "BREAK_GLASS_ABUSE_SUSPENSION", "User", doctor.id,
           {"patient_ids": all_patient_ids, "trigger_count": len(all_patient_ids)}, ip=ip)

    for admin_id in _get_all_admin_ids(db):
        _notify(db, admin_id,
                "🔴 Break-Glass Abuse — Doctor Suspended",
                f"Dr. {doctor.name} accessed {len(all_patient_ids)} patients' records within 30 minutes. Account automatically suspended.",
                NotificationType.BREAK_GLASS_SUSPENSION)


# ── Status ─────────────────────────────────────────────────────────────────────

def get_active_break_glass(db: Session, doctor_id: int, patient_id: int) -> BreakGlassRequest | None:
    """Return active (not expired/revoked) Break-Glass for this doctor+patient pair."""
    now = datetime.now(timezone.utc)
    req = (
        db.query(BreakGlassRequest)
        .filter(
            BreakGlassRequest.doctor_id == doctor_id,
            BreakGlassRequest.patient_id == patient_id,
            BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
            BreakGlassRequest.expires_at > now,
        )
        .order_by(BreakGlassRequest.granted_at.desc())
        .first()
    )
    return req


def log_break_glass_action(db: Session, request_id: int, action: str,
                            target_type: str | None = None, target_id: int | None = None,
                            details: dict | None = None) -> None:
    db.add(BreakGlassAction(request_id=request_id, action=action,
                             target_type=target_type, target_id=target_id, details=details))
    db.commit()


# ── Admin ──────────────────────────────────────────────────────────────────────

def list_all_break_glass(db: Session) -> list[BreakGlassRequest]:
    return db.query(BreakGlassRequest).order_by(BreakGlassRequest.granted_at.desc()).all()


def list_suspension_events(db: Session) -> list[BreakGlassSuspensionEvent]:
    return db.query(BreakGlassSuspensionEvent).order_by(BreakGlassSuspensionEvent.suspended_at.desc()).all()


def restore_from_suspension(db: Session, event_id: int, admin: User,
                             data: RestoreFromSuspensionRequest, ip: str | None = None) -> BreakGlassSuspensionEvent:
    event = db.query(BreakGlassSuspensionEvent).filter(BreakGlassSuspensionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Suspension event not found.")
    if event.restored_at:
        raise HTTPException(status_code=409, detail="Already restored.")

    doctor = db.query(User).filter(User.id == event.doctor_id).first()
    if doctor:
        doctor.status = UserStatus.ACTIVE
        doctor.suspension_reason = None

    event.restored_by = admin.id
    event.restored_at = datetime.now(timezone.utc)
    event.restore_notes = data.restore_notes

    _audit(db, admin.id, "BREAK_GLASS_SUSPENSION_RESTORED", "BreakGlassSuspensionEvent", event_id,
           {"restore_notes": data.restore_notes}, ip=ip)

    if doctor:
        _notify(db, doctor.id, "Account Restored",
                f"Your account has been restored by an administrator. {data.restore_notes or ''}",
                NotificationType.BREAK_GLASS_RESTORED)
    db.commit()
    return event
