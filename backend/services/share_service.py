"""Share service — internal permissions + external QR/link sharing."""
import base64
import io
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from config import settings
from core.exceptions import bad_request, forbidden, not_found
from models.notification import NotificationType
from models.report import ReportGroup, ReportRecord
from models.share import GranteeType, ReportPermission, ReportShare
from models.user import User, UserRole
from schemas.share import (
    ExternalShareCreate,
    ExternalShareRead,
    PermissionGrantRequest,
    PermissionRead,
    PermissionUpdateRequest,
)
from services import audit_service, notification_service


# ── Internal permissions ──────────────────────────────────────────────────────

def grant_permission(
    db: Session,
    data: PermissionGrantRequest,
    grantor: User,
) -> ReportPermission:
    """Patient grants access to a record for a user or specialization."""
    # Verify grantor owns the record's patient slot
    record = db.query(ReportRecord).filter(
        ReportRecord.id == data.record_id, ReportRecord.is_active == 1
    ).first()
    if not record:
        raise not_found("Report Record")

    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if not group:
        raise not_found("Report Group")

    if grantor.role != UserRole.ADMIN and group.patient_id != grantor.id:
        raise forbidden("Only the patient who owns this record can share it")

    # Validate grantee
    if data.grantee_type == GranteeType.USER:
        if not data.grantee_user_id:
            raise bad_request("grantee_user_id is required for USER grantee type")
        grantee = db.query(User).filter(User.id == data.grantee_user_id).first()
        if not grantee:
            raise not_found("Grantee user")
        grantee_name = grantee.name
    else:
        if not data.grantee_spec_id:
            raise bad_request("grantee_spec_id is required for SPECIALIZATION grantee type")
        from models.specialization import Specialization
        spec = db.query(Specialization).filter(
            Specialization.id == data.grantee_spec_id, Specialization.is_active == 1
        ).first()
        if not spec:
            raise not_found("Specialization")
        grantee_name = spec.name

    # Upsert: if existing permission exists, update it
    existing = _find_existing_permission(db, data)
    if existing:
        existing.can_view = data.can_view
        existing.can_download = data.can_download
        existing.can_share = data.can_share
        db.flush()
        perm = existing
        action = "SHARE_PERMISSION_CHANGED"
        notif_type = NotificationType.SHARE_PERMISSION_CHANGED
    else:
        perm = ReportPermission(
            record_id=data.record_id,
            granted_by=grantor.id,
            grantee_type=data.grantee_type,
            grantee_user_id=data.grantee_user_id,
            grantee_spec_id=data.grantee_spec_id,
            can_view=data.can_view,
            can_download=data.can_download,
            can_share=data.can_share,
        )
        db.add(perm)
        db.flush()
        action = "REPORT_SHARED"
        notif_type = NotificationType.REPORT_SHARED

    # Notify doctor (USER grantee only)
    if data.grantee_type == GranteeType.USER and data.grantee_user_id:
        notification_service.create_notification(
            db,
            recipient_id=data.grantee_user_id,
            title="Report Shared With You",
            message=f"A report record has been shared with you by a patient.",
            type=notif_type,
        )

    audit_service.create_log(
        db,
        action=action,
        actor=grantor,
        target_type="ReportPermission",
        target_id=perm.id,
        details={
            "record_id": data.record_id,
            "grantee_type": data.grantee_type,
            "grantee_id": data.grantee_user_id or data.grantee_spec_id,
            "can_view": data.can_view,
            "can_download": data.can_download,
            "can_share": data.can_share,
        },
    )
    db.commit()
    db.refresh(perm)
    return _enrich_permission(db, perm)


def list_permissions(db: Session, record_id: int, requester: User) -> list[ReportPermission]:
    record = db.query(ReportRecord).filter(ReportRecord.id == record_id).first()
    if not record:
        raise not_found("Report Record")
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    perms = db.query(ReportPermission).filter(
        ReportPermission.record_id == record_id
    ).all()
    return [_enrich_permission(db, p) for p in perms]


def update_permission(
    db: Session, perm_id: int, data: PermissionUpdateRequest, requester: User
) -> ReportPermission:
    perm = db.query(ReportPermission).filter(ReportPermission.id == perm_id).first()
    if not perm:
        raise not_found("Permission")
    record = db.query(ReportRecord).filter(ReportRecord.id == perm.record_id).first()
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    perm.can_view = data.can_view
    perm.can_download = data.can_download
    perm.can_share = data.can_share
    audit_service.create_log(
        db, action="SHARE_PERMISSION_CHANGED", actor=requester,
        target_type="ReportPermission", target_id=perm.id,
        details={"can_view": data.can_view, "can_download": data.can_download, "can_share": data.can_share},
    )
    db.commit()
    db.refresh(perm)
    return _enrich_permission(db, perm)


def revoke_permission(db: Session, perm_id: int, requester: User) -> None:
    perm = db.query(ReportPermission).filter(ReportPermission.id == perm_id).first()
    if not perm:
        raise not_found("Permission")
    record = db.query(ReportRecord).filter(ReportRecord.id == perm.record_id).first()
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()

    # Notify if USER grantee
    if perm.grantee_type == GranteeType.USER and perm.grantee_user_id:
        notification_service.create_notification(
            db,
            recipient_id=perm.grantee_user_id,
            title="Report Access Revoked",
            message="Your access to a shared report has been revoked.",
            type=NotificationType.SHARE_REVOKED,
        )

    audit_service.create_log(
        db, action="SHARE_PERMISSION_REVOKED", actor=requester,
        target_type="ReportPermission", target_id=perm.id,
        details={"record_id": perm.record_id},
    )
    db.delete(perm)
    db.commit()


# ── External shares ───────────────────────────────────────────────────────────

def create_external_share(
    db: Session, data: ExternalShareCreate, creator: User
) -> ExternalShareRead:
    record = db.query(ReportRecord).filter(
        ReportRecord.id == data.record_id, ReportRecord.is_active == 1
    ).first()
    if not record:
        raise not_found("Report Record")
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if creator.role != UserRole.ADMIN and group.patient_id != creator.id:
        raise forbidden("Only the patient can create external shares")

    token = secrets.token_urlsafe(36)
    share = ReportShare(
        record_id=data.record_id,
        created_by=creator.id,
        token=token,
        label=data.label,
    )
    db.add(share)
    db.flush()

    notification_service.create_notification(
        db,
        recipient_id=creator.id,
        title="External Share Created",
        message=f"An external share link has been created for a report record.",
        type=NotificationType.EXTERNAL_SHARE_CREATED,
    )
    audit_service.create_log(
        db, action="EXTERNAL_SHARE_CREATED", actor=creator,
        target_type="ReportShare", target_id=share.id,
        details={"record_id": data.record_id, "token_prefix": token[:8]},
    )
    db.commit()
    db.refresh(share)
    return _build_external_share_read(share)


def list_external_shares(db: Session, record_id: int, requester: User) -> list[ExternalShareRead]:
    record = db.query(ReportRecord).filter(ReportRecord.id == record_id).first()
    if not record:
        raise not_found("Report Record")
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    shares = db.query(ReportShare).filter(
        ReportShare.record_id == record_id, ReportShare.is_active == 1
    ).order_by(ReportShare.created_at.desc()).all()
    return [_build_external_share_read(s) for s in shares]


def revoke_external_share(db: Session, share_id: int, requester: User) -> None:
    share = db.query(ReportShare).filter(ReportShare.id == share_id).first()
    if not share:
        raise not_found("Share")
    record = db.query(ReportRecord).filter(ReportRecord.id == share.record_id).first()
    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    share.is_active = 0
    audit_service.create_log(
        db, action="EXTERNAL_SHARE_REVOKED", actor=requester,
        target_type="ReportShare", target_id=share.id,
        details={"record_id": share.record_id},
    )
    db.commit()


def resolve_external_share(db: Session, token: str, ip: str | None = None):
    """Validate token and return record + files for public view."""
    from models.report import ReportFile
    from sqlalchemy.orm import joinedload

    share = db.query(ReportShare).filter(
        ReportShare.token == token, ReportShare.is_active == 1
    ).first()
    if not share:
        raise not_found("Share link not found or has been revoked")

    # Update access stats
    share.access_count += 1
    share.last_accessed_at = datetime.now(timezone.utc)

    record = (
        db.query(ReportRecord)
        .options(joinedload(ReportRecord.files))
        .filter(ReportRecord.id == share.record_id, ReportRecord.is_active == 1)
        .first()
    )
    if not record:
        raise not_found("Report Record no longer available")

    group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first()

    audit_service.create_log(
        db, action="EXTERNAL_SHARE_ACCESSED",
        actor_id=None, actor_email=None,
        target_type="ReportShare", target_id=share.id,
        details={"record_id": record.id, "token_prefix": token[:8]},
        ip_address=ip,
    )
    db.commit()

    return {
        "record_id": record.id,
        "group_title": group.title if group else "",
        "test_type": group.test_type if group else "",
        "record_date": record.record_date,
        "record_type": record.record_type,
        "notes": record.notes,
        "lab_technician_name": record.lab_technician_name,
        "files": [
            {
                "id": f.id,
                "original_name": f.original_name,
                "mime_type": f.mime_type,
                "sort_order": f.sort_order,
            }
            for f in sorted(record.files, key=lambda x: x.sort_order)
            if f.is_active
        ],
        "share_label": share.label,
    }


def get_file_for_external_view(db: Session, token: str, file_id: int):
    """Serve a file to an external viewer (view-only; never download)."""
    from models.report import ReportFile
    share = db.query(ReportShare).filter(
        ReportShare.token == token, ReportShare.is_active == 1
    ).first()
    if not share:
        raise not_found("Share link not found or has been revoked")

    rf = db.query(ReportFile).filter(
        ReportFile.id == file_id, ReportFile.is_active == 1,
        ReportFile.record_id == share.record_id,
    ).first()
    if not rf:
        raise not_found("File")

    from storage.service import storage
    data = storage.read(rf.stored_path)
    audit_service.create_log(
        db, action="EXTERNAL_FILE_VIEWED",
        target_type="ReportFile", target_id=rf.id,
        details={"share_id": share.id, "token_prefix": token[:8]},
    )
    db.commit()
    return rf, data


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_existing_permission(db: Session, data: PermissionGrantRequest):
    q = db.query(ReportPermission).filter(
        ReportPermission.record_id == data.record_id,
        ReportPermission.grantee_type == data.grantee_type,
    )
    if data.grantee_type == GranteeType.USER:
        q = q.filter(ReportPermission.grantee_user_id == data.grantee_user_id)
    else:
        q = q.filter(ReportPermission.grantee_spec_id == data.grantee_spec_id)
    return q.first()


def _enrich_permission(db: Session, perm: ReportPermission) -> ReportPermission:
    """Attach grantee_name as a transient attribute."""
    if perm.grantee_type == GranteeType.USER and perm.grantee_user_id:
        u = db.query(User).filter(User.id == perm.grantee_user_id).first()
        perm.__dict__["grantee_name"] = u.name if u else None
    elif perm.grantee_type == GranteeType.SPECIALIZATION and perm.grantee_spec_id:
        from models.specialization import Specialization
        s = db.query(Specialization).filter(Specialization.id == perm.grantee_spec_id).first()
        perm.__dict__["grantee_name"] = s.name if s else None
    else:
        perm.__dict__["grantee_name"] = None
    return perm


def _build_external_share_read(share: ReportShare) -> ExternalShareRead:
    share_url = f"{settings.EXTERNAL_BASE_URL}/shared/{share.token}"
    qr_b64 = _generate_qr_base64(share_url)
    result = ExternalShareRead.model_validate(share)
    result.share_url = share_url
    result.qr_base64 = qr_b64
    return result


def _generate_qr_base64(url: str) -> str:
    try:
        import qrcode
        from PIL import Image
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        return ""
