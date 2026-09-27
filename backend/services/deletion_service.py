"""Deletion service — suspend, restore, permanently delete report records (Phase 3A)."""
import os
import shutil
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from config import settings
from core.exceptions import bad_request, forbidden, not_found
from models.deletion import DeletionRequest, DeletionRequestStatus
from models.notification import NotificationType
from models.report import ReportFile, ReportGroup, ReportRecord, SuspensionStatus
from models.user import User, UserRole
from services import audit_service, notification_service


def request_deletion(
    db: Session,
    record_id: int,
    reason: str,
    requester: User,
) -> DeletionRequest:
    """Non-admin requests deletion → record SUSPENDED, files moved to quarantine."""
    record = db.query(ReportRecord).options(
        joinedload(ReportRecord.files),
        joinedload(ReportRecord.group),
    ).filter(ReportRecord.id == record_id, ReportRecord.is_active == 1).first()
    if not record:
        raise not_found("Report Record")

    group = record.group
    # Only patient (owner), technician who uploaded, or admin can request
    if requester.role == UserRole.PATIENT and group.patient_id != requester.id:
        raise forbidden("You do not own this record")
    if requester.role == UserRole.ADMIN:
        raise bad_request("Admins should use the admin permanent-delete endpoint directly")

    if record.suspension_status != SuspensionStatus.ACTIVE:
        raise bad_request("Record is already suspended or deleted")

    # Check for existing pending request
    existing = db.query(DeletionRequest).filter(
        DeletionRequest.record_id == record_id,
        DeletionRequest.status == DeletionRequestStatus.PENDING,
    ).first()
    if existing:
        raise bad_request("A pending deletion request already exists for this record")

    # Move files to quarantine
    _move_files_to_quarantine(record.files, record_id)

    # Suspend the record
    record.suspension_status = SuspensionStatus.SUSPENDED
    record.suspension_reason = reason
    record.suspended_by = requester.id
    record.suspended_at = datetime.now(timezone.utc)

    dr = DeletionRequest(
        record_id=record_id,
        requested_by=requester.id,
        reason=reason,
        status=DeletionRequestStatus.PENDING,
    )
    db.add(dr)
    db.flush()

    # Notify patient (if technician requested) and audit
    if requester.role != UserRole.PATIENT:
        notification_service.create_notification(
            db,
            recipient_id=group.patient_id,
            title="Report Record Suspended",
            message=f"A report record in '{group.title}' has been suspended pending admin review.",
            type=NotificationType.RECORD_SUSPENDED,
        )

    audit_service.create_log(
        db,
        action="RECORD_DELETION_REQUESTED",
        actor=requester,
        target_type="ReportRecord",
        target_id=record_id,
        details={"reason": reason, "deletion_request_id": dr.id},
    )
    db.commit()
    db.refresh(dr)
    return dr


def admin_restore(
    db: Session,
    deletion_request_id: int,
    admin: User,
    review_notes: str | None = None,
) -> DeletionRequest:
    """Admin restores a suspended record — files moved back from quarantine."""
    if admin.role != UserRole.ADMIN:
        raise forbidden()

    dr = db.query(DeletionRequest).options(
        joinedload(DeletionRequest.record).joinedload(ReportRecord.files),
        joinedload(DeletionRequest.record).joinedload(ReportRecord.group),
    ).filter(
        DeletionRequest.id == deletion_request_id,
        DeletionRequest.status == DeletionRequestStatus.PENDING,
    ).first()
    if not dr:
        raise not_found("Pending deletion request")

    record = dr.record
    group = record.group

    # Move files back from quarantine to active storage
    _move_files_from_quarantine(record.files, record.id)

    record.suspension_status = SuspensionStatus.ACTIVE
    record.suspension_reason = None
    record.suspended_by = None
    record.suspended_at = None

    dr.status = DeletionRequestStatus.RESTORED
    dr.reviewed_by = admin.id
    dr.reviewed_at = datetime.now(timezone.utc)
    dr.review_notes = review_notes

    # Notify patient
    notification_service.create_notification(
        db,
        recipient_id=group.patient_id,
        title="Report Record Restored",
        message=f"A previously suspended record in '{group.title}' has been restored by an administrator.",
        type=NotificationType.RECORD_RESTORED,
    )

    audit_service.create_log(
        db,
        action="RECORD_RESTORED",
        actor=admin,
        target_type="ReportRecord",
        target_id=record.id,
        details={"deletion_request_id": dr.id, "review_notes": review_notes},
    )
    db.commit()
    db.refresh(dr)
    return dr


def admin_permanent_delete(
    db: Session,
    deletion_request_id: int,
    admin: User,
    review_notes: str | None = None,
) -> None:
    """Admin permanently deletes a suspended record — files moved to recycle_bin."""
    if admin.role != UserRole.ADMIN:
        raise forbidden()

    dr = db.query(DeletionRequest).options(
        joinedload(DeletionRequest.record).joinedload(ReportRecord.files),
        joinedload(DeletionRequest.record).joinedload(ReportRecord.group),
    ).filter(
        DeletionRequest.id == deletion_request_id,
        DeletionRequest.status == DeletionRequestStatus.PENDING,
    ).first()
    if not dr:
        raise not_found("Pending deletion request")

    record = dr.record
    group = record.group

    # Move files from quarantine → recycle_bin
    _move_files_to_recycle_bin(record.files, record.id)

    record.suspension_status = SuspensionStatus.PERMANENTLY_DELETED
    record.is_active = 0

    # Mark files inactive
    for f in record.files:
        f.is_active = 0

    dr.status = DeletionRequestStatus.PERMANENTLY_DELETED
    dr.reviewed_by = admin.id
    dr.reviewed_at = datetime.now(timezone.utc)
    dr.review_notes = review_notes

    notification_service.create_notification(
        db,
        recipient_id=group.patient_id,
        title="Report Record Permanently Deleted",
        message=f"A record in '{group.title}' has been permanently deleted by an administrator.",
        type=NotificationType.RECORD_PERMANENTLY_DELETED,
    )

    audit_service.create_log(
        db,
        action="RECORD_PERMANENTLY_DELETED",
        actor=admin,
        target_type="ReportRecord",
        target_id=record.id,
        details={"deletion_request_id": dr.id},
    )
    db.commit()


def list_deletion_requests(
    db: Session,
    status: str | None = None,
) -> list[dict]:
    q = db.query(DeletionRequest).options(
        joinedload(DeletionRequest.requester),
        joinedload(DeletionRequest.reviewer),
        joinedload(DeletionRequest.record).joinedload(ReportRecord.group),
    )
    if status:
        try:
            s = DeletionRequestStatus(status)
            q = q.filter(DeletionRequest.status == s)
        except ValueError:
            pass
    requests = q.order_by(DeletionRequest.created_at.desc()).all()

    result = []
    for dr in requests:
        record = dr.record
        group = record.group if record else None
        result.append({
            "id": dr.id,
            "record_id": dr.record_id,
            "requested_by": dr.requested_by,
            "requester_name": dr.requester.name if dr.requester else "",
            "reason": dr.reason,
            "status": dr.status,
            "reviewed_by": dr.reviewed_by,
            "reviewer_name": dr.reviewer.name if dr.reviewer else None,
            "reviewed_at": dr.reviewed_at,
            "review_notes": dr.review_notes,
            "group_title": group.title if group else "",
            "patient_name": group.patient.name if group and group.patient else "",
            "record_type": record.record_type if record else "",
            "record_date": record.record_date if record else None,
            "created_at": dr.created_at,
        })
    return result


# ── File movement helpers ─────────────────────────────────────────────────────

def _move_files_to_quarantine(files: list, record_id: int) -> None:
    dest_dir = os.path.join(settings.quarantine_dir_abs, str(record_id))
    os.makedirs(dest_dir, exist_ok=True)
    for f in files:
        if not f.is_active:
            continue
        src = os.path.join(settings.upload_dir_abs, f.stored_path)
        if os.path.isfile(src):
            dst = os.path.join(dest_dir, os.path.basename(f.stored_path))
            shutil.move(src, dst)
            # Update stored_path to quarantine relative path
            f.stored_path = os.path.join("quarantine", str(record_id), os.path.basename(f.stored_path))


def _move_files_from_quarantine(files: list, record_id: int) -> None:
    for f in files:
        fname = os.path.basename(f.stored_path)
        src = os.path.join(settings.quarantine_dir_abs, str(record_id), fname)
        if os.path.isfile(src):
            # Restore to original subfolder structure
            orig_rel = os.path.join("reports", fname)
            dest = os.path.join(settings.upload_dir_abs, orig_rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(src, dest)
            f.stored_path = orig_rel


def _move_files_to_recycle_bin(files: list, record_id: int) -> None:
    dest_dir = os.path.join(settings.recycle_bin_dir_abs, str(record_id))
    os.makedirs(dest_dir, exist_ok=True)
    for f in files:
        fname = os.path.basename(f.stored_path)
        # Could be in quarantine or active storage
        src_q = os.path.join(settings.quarantine_dir_abs, str(record_id), fname)
        src_a = os.path.join(settings.upload_dir_abs, f.stored_path)
        src = src_q if os.path.isfile(src_q) else src_a
        if os.path.isfile(src):
            dst = os.path.join(dest_dir, fname)
            shutil.move(src, dst)
            f.stored_path = os.path.join("recycle_bin", str(record_id), fname)
