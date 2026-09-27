"""Document Dispute service."""
from __future__ import annotations
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.dispute import DocumentDispute, DisputeAuditEntry, DisputeStatus, DisputeReason
from models.report import ReportRecord, ReportGroup, SuspensionStatus
from models.user import User, UserRole, UserStatus
from models.notification import Notification, NotificationType
from models.audit import AuditLog
from schemas.dispute import DisputeCreate, DisputeActionRequest


def _notify(db: Session, recipient_id: int, title: str, message: str, ntype: NotificationType) -> None:
    db.add(Notification(recipient_id=recipient_id, title=title, message=message, type=ntype))


def _audit(db: Session, actor_id: int | None, action: str, target_id: int | None = None,
           details: dict | None = None, ip: str | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target_type="DocumentDispute",
                    target_id=target_id, details=details, ip_address=ip))


def _get_all_admin_ids(db: Session) -> list[int]:
    return [u.id for u in db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE).all()]


# ── Patient creates dispute ────────────────────────────────────────────────────

def create_dispute(db: Session, data: DisputeCreate, patient: User, ip: str | None = None) -> DocumentDispute:
    record = db.query(ReportRecord).filter(ReportRecord.id == data.record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found.")

    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Report group not found.")

    if group.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="This record does not belong to you.")

    dispute = DocumentDispute(
        patient_id=patient.id,
        record_id=record.id,
        group_id=record.group_id,
        reason=data.reason,
        explanation=data.explanation,
        status=DisputeStatus.OPEN,
    )
    db.add(dispute)
    db.flush()

    db.add(DisputeAuditEntry(dispute_id=dispute.id, actor_id=patient.id, action="DISPUTE_CREATED",
                              notes=f"Reason: {data.reason} — {data.explanation[:100]}"))

    _audit(db, patient.id, "DOCUMENT_DISPUTE_CREATED", dispute.id,
           {"record_id": record.id, "reason": data.reason.value})

    for admin_id in _get_all_admin_ids(db):
        _notify(db, admin_id, "📋 Document Dispute",
                f"Patient {patient.name} disputes record in '{group.title}'. Reason: {data.reason.value}",
                NotificationType.DOCUMENT_DISPUTE_CREATED)

    db.commit()
    return dispute


# ── Admin actions ──────────────────────────────────────────────────────────────

def admin_act_on_dispute(db: Session, dispute_id: int, data: DisputeActionRequest,
                          admin: User, ip: str | None = None) -> DocumentDispute:
    dispute = db.query(DocumentDispute).filter(DocumentDispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found.")

    record = db.query(ReportRecord).filter(ReportRecord.id == dispute.record_id).first()
    action = data.action.upper()

    if action == "REVIEW":
        dispute.status = DisputeStatus.UNDER_REVIEW
        audit_action = "DISPUTE_UNDER_REVIEW"
    elif action == "QUARANTINE":
        dispute.status = DisputeStatus.QUARANTINED
        if record:
            record.suspension_status = SuspensionStatus.SUSPENDED
        audit_action = "DISPUTE_QUARANTINED"
        # Notify patient
        _notify(db, dispute.patient_id, "📋 Dispute Update",
                "The disputed record has been quarantined pending investigation.",
                NotificationType.DISPUTE_QUARANTINED)
    elif action == "REASSIGN":
        if not data.reassign_patient_id:
            raise HTTPException(status_code=422, detail="reassign_patient_id required for REASSIGN action.")
        new_patient = db.query(User).filter(User.id == data.reassign_patient_id, User.role == UserRole.PATIENT).first()
        if not new_patient:
            raise HTTPException(status_code=404, detail="Target patient not found.")
        if record:
            group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
            if group:
                group.patient_id = data.reassign_patient_id
        dispute.reassigned_to_patient_id = data.reassign_patient_id
        dispute.reassigned_at = datetime.now(timezone.utc)
        dispute.status = DisputeStatus.REASSIGNED
        audit_action = "DISPUTE_REASSIGNED"
        _notify(db, dispute.patient_id, "📋 Dispute Resolved — Reassigned",
                "The disputed record has been reassigned to the correct patient.",
                NotificationType.DISPUTE_REASSIGNED)
    elif action == "RESOLVE":
        dispute.status = DisputeStatus.RESOLVED
        audit_action = "DISPUTE_RESOLVED"
        _notify(db, dispute.patient_id, "📋 Dispute Resolved",
                f"Your document dispute has been resolved. Notes: {data.notes or 'No notes'}",
                NotificationType.DOCUMENT_DISPUTE_RESOLVED)
    elif action == "DISMISS":
        dispute.status = DisputeStatus.DISMISSED
        audit_action = "DISPUTE_DISMISSED"
        _notify(db, dispute.patient_id, "📋 Dispute Dismissed",
                f"Your document dispute has been dismissed. Notes: {data.notes or 'No notes'}",
                NotificationType.DOCUMENT_DISPUTE_UPDATED)
    else:
        raise HTTPException(status_code=422, detail=f"Unknown action: {action}")

    dispute.reviewed_by = admin.id
    dispute.reviewed_at = datetime.now(timezone.utc)
    dispute.review_notes = data.notes

    db.add(DisputeAuditEntry(dispute_id=dispute.id, actor_id=admin.id, action=audit_action, notes=data.notes))
    _audit(db, admin.id, f"ADMIN_{audit_action}", dispute.id, {"action": action, "notes": data.notes}, ip)
    db.commit()
    return dispute


def list_disputes(db: Session, status: str | None = None) -> list[DocumentDispute]:
    q = db.query(DocumentDispute)
    if status:
        q = q.filter(DocumentDispute.status == status)
    return q.order_by(DocumentDispute.created_at.desc()).all()


def get_patient_disputes(db: Session, patient_id: int) -> list[DocumentDispute]:
    return db.query(DocumentDispute).filter(DocumentDispute.patient_id == patient_id).order_by(DocumentDispute.created_at.desc()).all()
