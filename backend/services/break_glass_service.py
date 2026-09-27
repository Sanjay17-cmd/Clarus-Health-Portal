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

from models.break_glass import (
    BreakGlassRequest, BreakGlassAction, BreakGlassSuspensionEvent,
    BreakGlassStatus, BgDownloadRequest, BgShareRequest, BgRequestStatus
)
from models.user import User, UserStatus, UserRole
from models.notification import Notification, NotificationType
from models.audit import AuditLog
from models.access_event import RecordAccessEvent
from models.group_share import GroupShare
from schemas.break_glass import (
    BreakGlassRequestCreate, RestoreFromSuspensionRequest,
    BgDownloadRequestCreate, BgDownloadReviewRequest,
    BgShareRequestCreate, BgShareReviewRequest
)

BG_FREE_SHARES = 3  # shares 1-3 auto-allowed; 4+ require admin approval

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


# ── Emergency Record Access ───────────────────────────────────────────────────

def get_bg_records(db: Session, bg_request_id: int, doctor_id: int):
    """Return report groups+records visible under an active BG session."""
    bg = db.query(BreakGlassRequest).filter(
        BreakGlassRequest.id == bg_request_id,
        BreakGlassRequest.doctor_id == doctor_id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
    ).first()
    if not bg:
        raise HTTPException(status_code=403, detail="No active Break-Glass access.")
    now = datetime.now(timezone.utc)
    if bg.expires_at < now:
        bg.status = BreakGlassStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=403, detail="Break-Glass session has expired.")
    from models.report import ReportGroup, ReportRecord
    groups = db.query(ReportGroup).filter(ReportGroup.patient_id == bg.patient_id).all()
    return bg, groups


# ── BG Download Requests ──────────────────────────────────────────────────────

def create_download_request(
    db: Session, data: BgDownloadRequestCreate, doctor: User, ip: str | None = None
) -> BgDownloadRequest:
    """Doctor requests admin approval to download specific BG files."""
    if doctor.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account not active.")
    bg = db.query(BreakGlassRequest).filter(
        BreakGlassRequest.id == data.bg_request_id,
        BreakGlassRequest.doctor_id == doctor.id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
    ).first()
    if not bg:
        raise HTTPException(status_code=403, detail="No active Break-Glass for this request.")
    now = datetime.now(timezone.utc)
    if bg.expires_at < now:
        raise HTTPException(status_code=403, detail="Break-Glass session expired.")

    patient = db.query(User).filter(User.id == bg.patient_id).first()
    req = BgDownloadRequest(
        bg_request_id=data.bg_request_id,
        doctor_id=doctor.id,
        patient_id=bg.patient_id,
        group_id=data.group_id,
        record_ids=data.record_ids,
        file_ids=data.file_ids,
        reason=data.reason,
        status=BgRequestStatus.PENDING,
    )
    db.add(req)
    db.flush()

    _audit(db, doctor.id, "BG_DOWNLOAD_REQUESTED", "BgDownloadRequest", req.id,
           {"bg_id": bg.id, "record_ids": data.record_ids, "file_ids": data.file_ids, "reason": data.reason}, ip=ip)

    for admin_id in _get_all_admin_ids(db):
        _notify(db, admin_id, "🚨 Emergency Download Request",
                f"Dr. {doctor.name} requested emergency download from patient {patient.name if patient else bg.patient_id}. BG#{bg.id}.",
                NotificationType.BREAK_GLASS_REQUEST)

    _notify(db, bg.patient_id, "Emergency Download Requested",
            f"Dr. {doctor.name} has requested permission to download your emergency-access records.",
            NotificationType.BREAK_GLASS_REQUEST)

    db.commit()
    return req


def review_download_request(
    db: Session, req_id: int, data: BgDownloadReviewRequest, admin: User, ip: str | None = None
) -> BgDownloadRequest:
    """Admin approves or rejects a BG download request."""
    req = db.query(BgDownloadRequest).filter(BgDownloadRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Download request not found.")
    if req.status != BgRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Already reviewed.")

    req.status = BgRequestStatus.APPROVED if data.approved else BgRequestStatus.REJECTED
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = data.review_notes

    doctor = db.query(User).filter(User.id == req.doctor_id).first()
    patient = db.query(User).filter(User.id == req.patient_id).first()
    action = "BG_DOWNLOAD_APPROVED" if data.approved else "BG_DOWNLOAD_REJECTED"
    _audit(db, admin.id, action, "BgDownloadRequest", req_id, {"approved": data.approved, "notes": data.review_notes}, ip=ip)

    status_word = "approved" if data.approved else "rejected"
    if doctor:
        _notify(db, doctor.id, f"Download Request {status_word.title()}",
                f"Your emergency download request (BG#{req.bg_request_id}) has been {status_word}. {data.review_notes or ''}",
                NotificationType.BREAK_GLASS_RESTORED if data.approved else NotificationType.BREAK_GLASS_SUSPENSION)
    if patient:
        _notify(db, patient.id, f"Emergency Download {status_word.title()}",
                f"Admin has {status_word} Dr. {doctor.name if doctor else req.doctor_id}'s emergency download request.",
                NotificationType.BREAK_GLASS_REQUEST)
    db.commit()
    return req


def perform_approved_download(
    db: Session, req_id: int, file_id: int, doctor: User, ip: str | None = None
):
    """Perform actual download — enforces scope strictly; marks download_performed."""
    req = db.query(BgDownloadRequest).filter(BgDownloadRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Download request not found.")
    if req.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your download request.")
    if req.status != BgRequestStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Download not yet approved.")
    # Scope enforcement — file must be in the approved list
    approved_files = req.file_ids if isinstance(req.file_ids, list) else []
    if file_id not in approved_files:
        _audit(db, doctor.id, "BG_DOWNLOAD_SCOPE_VIOLATION", "BgDownloadRequest", req_id,
               {"attempted_file_id": file_id, "approved_file_ids": approved_files}, ip=ip)
        raise HTTPException(status_code=403, detail="File not in approved download scope.")
    # Mark
    req.download_performed = 1
    req.downloaded_at = datetime.now(timezone.utc)
    _audit(db, doctor.id, "BG_DOWNLOAD_PERFORMED", "BgDownloadRequest", req_id,
           {"file_id": file_id}, ip=ip)
    patient = db.query(User).filter(User.id == req.patient_id).first()
    if patient:
        _notify(db, patient.id, "Emergency Record Downloaded",
                f"Dr. {doctor.name} downloaded your emergency-access record (approved by Admin).",
                NotificationType.DOCTOR_DOWNLOADED)
    db.commit()
    return req


def list_download_requests_for_doctor(db: Session, doctor_id: int) -> list[BgDownloadRequest]:
    return db.query(BgDownloadRequest).filter(BgDownloadRequest.doctor_id == doctor_id).order_by(BgDownloadRequest.created_at.desc()).all()


def list_all_download_requests(db: Session) -> list[BgDownloadRequest]:
    return db.query(BgDownloadRequest).order_by(BgDownloadRequest.created_at.desc()).all()


# ── BG Emergency Share Chain ──────────────────────────────────────────────────

def _count_bg_shares(db: Session, bg_request_id: int) -> int:
    """Count approved/pending shares from this BG event (not file views, not downloads)."""
    return db.query(func.count(BgShareRequest.id)).filter(
        BgShareRequest.bg_request_id == bg_request_id,
        BgShareRequest.status.in_([BgRequestStatus.APPROVED, BgRequestStatus.PENDING]),
    ).scalar() or 0


def request_emergency_share(
    db: Session, data: BgShareRequestCreate, doctor: User, ip: str | None = None
) -> dict:
    """Share a BG record with another doctor. Shares 1-3 auto-approve; 4+ go to admin."""
    if doctor.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Account not active.")
    bg = db.query(BreakGlassRequest).filter(
        BreakGlassRequest.id == data.bg_request_id,
        BreakGlassRequest.doctor_id == doctor.id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
    ).first()
    if not bg:
        raise HTTPException(status_code=403, detail="No active Break-Glass for this request.")

    # No permission escalation: BG shares cannot grant download unless parent BG would allow it
    # For safety, always default can_download=False for BG shares
    safe_can_download = False

    existing_count = _count_bg_shares(db, data.bg_request_id)
    new_count = existing_count + 1

    patient = db.query(User).filter(User.id == bg.patient_id).first()
    recipient = db.query(User).filter(User.id == data.recipient_doctor_id, User.role == UserRole.DOCTOR).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient doctor not found.")

    req = BgShareRequest(
        bg_request_id=data.bg_request_id,
        requesting_doctor_id=doctor.id,
        recipient_doctor_id=data.recipient_doctor_id,
        patient_id=bg.patient_id,
        group_id=data.group_id,
        record_ids=data.record_ids,
        file_ids=data.file_ids,
        can_download=0,
        share_count=new_count,
        reason=data.reason,
    )

    if new_count <= BG_FREE_SHARES:
        # Auto-approve: create group share immediately
        req.status = BgRequestStatus.APPROVED
        db.add(req)
        db.flush()
        _notify(db, data.recipient_doctor_id, "🚨 Emergency Record Shared With You",
                f"Dr. {doctor.name} has shared an emergency-access record (BG#{bg.id}) with you. View-only access.",
                NotificationType.REPORT_SHARED)
        if patient:
            _notify(db, patient.id, "Emergency Record Shared",
                    f"Dr. {doctor.name} shared your emergency-access records with Dr. {recipient.name}.",
                    NotificationType.EMERGENCY_SHARE_CREATED)
        _audit(db, doctor.id, "BG_SHARE_CREATED", "BgShareRequest", req.id,
               {"bg_id": bg.id, "recipient_id": data.recipient_doctor_id, "share_count": new_count}, ip=ip)
        db.commit()
        return {"status": "approved", "share_request": req, "requires_admin": False}
    else:
        # Requires admin approval
        req.status = BgRequestStatus.PENDING
        db.add(req)
        db.flush()
        for admin_id in _get_all_admin_ids(db):
            _notify(db, admin_id, "🚨 Emergency Share #4+ Requires Approval",
                    f"Dr. {doctor.name} wants to make emergency share #{new_count} from BG#{bg.id}. Admin approval required.",
                    NotificationType.BREAK_GLASS_REQUEST)
        _audit(db, doctor.id, "BG_SHARE_PENDING_APPROVAL", "BgShareRequest", req.id,
               {"bg_id": bg.id, "recipient_id": data.recipient_doctor_id, "share_count": new_count}, ip=ip)
        db.commit()
        return {"status": "pending_admin_approval", "share_request": req, "requires_admin": True}


def review_share_request(
    db: Session, req_id: int, data: BgShareReviewRequest, admin: User, ip: str | None = None
) -> BgShareRequest:
    req = db.query(BgShareRequest).filter(BgShareRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Share request not found.")
    if req.status != BgRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="Already reviewed.")

    req.status = BgRequestStatus.APPROVED if data.approved else BgRequestStatus.REJECTED
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = data.review_notes

    doctor = db.query(User).filter(User.id == req.requesting_doctor_id).first()
    patient = db.query(User).filter(User.id == req.patient_id).first()
    recipient = db.query(User).filter(User.id == req.recipient_doctor_id).first()
    action = "BG_SHARE_APPROVED" if data.approved else "BG_SHARE_REJECTED"
    _audit(db, admin.id, action, "BgShareRequest", req_id, {"approved": data.approved, "notes": data.review_notes}, ip=ip)

    status_word = "approved" if data.approved else "rejected"
    if doctor:
        _notify(db, doctor.id, f"Emergency Share {status_word.title()}",
                f"Your emergency share request #{req.share_count} has been {status_word}. {data.review_notes or ''}",
                NotificationType.BREAK_GLASS_RESTORED if data.approved else NotificationType.BREAK_GLASS_SUSPENSION)
    if data.approved and recipient:
        _notify(db, recipient.id, "🚨 Emergency Record Shared With You",
                f"Dr. {doctor.name if doctor else req.requesting_doctor_id} has shared an emergency record with you (Admin approved).",
                NotificationType.REPORT_SHARED)
    if patient:
        _notify(db, patient.id, f"Emergency Share {status_word.title()}",
                f"An emergency share of your records has been {status_word} by Admin.",
                NotificationType.EMERGENCY_SHARE_CREATED)
    db.commit()
    return req


def list_all_share_requests(db: Session) -> list[BgShareRequest]:
    return db.query(BgShareRequest).order_by(BgShareRequest.created_at.desc()).all()


def list_share_requests_for_doctor(db: Session, doctor_id: int) -> list[BgShareRequest]:
    return db.query(BgShareRequest).filter(BgShareRequest.requesting_doctor_id == doctor_id).order_by(BgShareRequest.created_at.desc()).all()
