"""Group Share service — Phase 4: version/file-aware sharing with delegation and accept/revoke."""
from datetime import datetime
from sqlalchemy.orm import Session

from core.exceptions import bad_request, forbidden, not_found
from models.group_share import (
    GroupShare, GroupGranteeType, ShareStatus,
    GroupShareRecord, GroupShareFile, ShareExport, ShareImport
)
from models.notification import NotificationType
from models.report import ReportGroup, ReportRecord, ReportFile, SuspensionStatus
from models.user import User, UserRole
from schemas.group_share import GroupShareCreate, GroupShareRead, GroupShareUpdate, GroupShareDelegateCreate
from services import audit_service, notification_service


# ── Create share (Patient) ────────────────────────────────────────────────────

def create_group_share(db: Session, data: GroupShareCreate, grantor: User) -> GroupShare:
    group = db.query(ReportGroup).filter(
        ReportGroup.id == data.group_id, ReportGroup.is_active == 1
    ).first()
    if not group:
        raise not_found("Report Group")

    # Only the patient who owns the group (or admin) may share
    if grantor.role != UserRole.ADMIN and group.patient_id != grantor.id:
        raise forbidden("Only the patient who owns this group can share it")

    # Validate grantee
    grantee_name, notify_id = _validate_grantee(db, data)

    # Validate explicit record scope (if provided)
    if data.record_ids:
        _validate_record_scope(db, data.record_ids, data.group_id)

    # Validate explicit file scope (if provided)
    if data.file_ids_by_record:
        _validate_file_scope(db, data.file_ids_by_record, data.record_ids or [])

    # Upsert existing share
    existing = _find_existing(db, data)
    if existing:
        existing.max_versions = data.max_versions
        existing.can_view = data.can_view
        existing.can_download = data.can_download
        existing.can_share = data.can_share
        existing.can_delegate = data.can_delegate
        existing.is_active = 1
        existing.status = ShareStatus.PENDING
        existing.revoked_at = None
        existing.revoked_by = None
        # Replace scope
        db.query(GroupShareRecord).filter(GroupShareRecord.share_id == existing.id).delete()
        db.query(GroupShareFile).filter(GroupShareFile.share_id == existing.id).delete()
        db.flush()
        share = existing
    else:
        share = GroupShare(
            group_id=data.group_id,
            granted_by=grantor.id,
            grantee_type=data.grantee_type,
            grantee_user_id=data.grantee_user_id,
            grantee_spec_id=data.grantee_spec_id,
            max_versions=data.max_versions,
            can_view=data.can_view,
            can_download=data.can_download,
            can_share=data.can_share,
            can_delegate=data.can_delegate,
            status=ShareStatus.PENDING,
        )
        db.add(share)
        db.flush()

    # Store explicit record scope
    if data.record_ids:
        for rid in data.record_ids:
            db.add(GroupShareRecord(share_id=share.id, record_id=rid))

    # Store explicit file scope
    if data.file_ids_by_record:
        for record_id, file_ids in data.file_ids_by_record.items():
            for fid in file_ids:
                db.add(GroupShareFile(share_id=share.id, record_id=int(record_id), file_id=fid))

    db.flush()

    # Build scope description for notification
    scope_parts = []
    if data.record_ids:
        scope_parts.append(f"{len(data.record_ids)} specific version(s)")
    elif data.max_versions > 0:
        scope_parts.append(f"latest {data.max_versions} version(s)")
    else:
        scope_parts.append("all versions")
    scope_str = ", ".join(scope_parts)
    download_str = "View + Download" if data.can_download else "View Only"

    if notify_id:
        notification_service.create_notification(
            db,
            recipient_id=notify_id,
            title="Report Group Shared With You",
            message=(
                f"{grantor.name} shared '{group.title}' with you. "
                f"Scope: {scope_str}. Access: {download_str}."
                + (" Delegation allowed." if data.can_delegate else "")
            ),
            type=NotificationType.REPORT_SHARED,
        )

    audit_service.create_log(
        db, action="GROUP_SHARE_CREATED", actor=grantor,
        target_type="GroupShare", target_id=share.id,
        details={
            "group_id": data.group_id,
            "max_versions": data.max_versions,
            "record_ids": data.record_ids,
            "can_download": data.can_download,
            "can_delegate": data.can_delegate,
            "grantee_name": grantee_name,
        },
    )
    db.commit()
    db.refresh(share)
    return _enrich(db, share)


# ── Accept share (Doctor) ─────────────────────────────────────────────────────

def accept_group_share(db: Session, share_id: int, doctor: User) -> GroupShare:
    share = _get_share_for_doctor(db, share_id, doctor)
    if share.status == ShareStatus.ACCEPTED:
        return _enrich(db, share)
    if share.status == ShareStatus.REVOKED:
        raise bad_request("This share has been revoked by the patient.")
    share.status = ShareStatus.ACCEPTED
    share.accepted_at = datetime.utcnow()

    # Notify patient that doctor accepted
    group = db.query(ReportGroup).filter(ReportGroup.id == share.group_id).first()
    notification_service.create_notification(
        db,
        recipient_id=share.granted_by,
        title="Share Accepted",
        message=f"Dr. {doctor.name} accepted access to your '{group.title if group else 'report'}' report.",
        type=NotificationType.GENERAL,
    )
    audit_service.create_log(
        db, action="GROUP_SHARE_ACCEPTED", actor=doctor,
        target_type="GroupShare", target_id=share.id,
        details={"group_id": share.group_id},
    )
    db.commit()
    db.refresh(share)
    return _enrich(db, share)


# ── Delegate share (Doctor → Doctor) ─────────────────────────────────────────

def delegate_group_share(db: Session, share_id: int, data: GroupShareDelegateCreate, doctor: User) -> GroupShare:
    parent = _get_share_for_doctor(db, share_id, doctor)
    if not parent.can_delegate:
        raise forbidden("This share does not allow delegation.")
    if parent.status != ShareStatus.ACCEPTED:
        raise bad_request("Accept this share before delegating.")

    # Validate new doctor
    new_doctor = db.query(User).filter(User.id == data.grantee_user_id, User.role == UserRole.DOCTOR).first()
    if not new_doctor:
        raise not_found("Target doctor")

    # Cannot escalate download
    child_can_download = data.can_download and parent.can_download

    # Validate scope doesn't exceed parent
    parent_record_ids = _get_allowed_record_ids_for_share(db, parent)
    child_record_ids = data.record_ids
    if child_record_ids and parent_record_ids is not None:
        invalid = [r for r in child_record_ids if r not in parent_record_ids]
        if invalid:
            raise bad_request(f"Record IDs {invalid} are not in the original share scope.")

    # Validate file scope doesn't exceed parent
    if data.file_ids_by_record:
        for rid, fids in data.file_ids_by_record.items():
            parent_files = _get_allowed_file_ids_for_record(db, parent, int(rid))
            if parent_files is not None:
                invalid_files = [f for f in fids if f not in parent_files]
                if invalid_files:
                    raise bad_request(f"File IDs {invalid_files} not in parent share scope for record {rid}.")

    child_share = GroupShare(
        group_id=parent.group_id,
        granted_by=doctor.id,
        grantee_type=GroupGranteeType.USER,
        grantee_user_id=data.grantee_user_id,
        max_versions=parent.max_versions,
        can_view=True,
        can_download=child_can_download,
        can_share=False,
        can_delegate=False,
        status=ShareStatus.PENDING,
        parent_share_id=parent.id,
    )
    db.add(child_share)
    db.flush()

    # Explicit record scope for child
    effective_record_ids = child_record_ids or parent_record_ids
    if effective_record_ids:
        for rid in effective_record_ids:
            db.add(GroupShareRecord(share_id=child_share.id, record_id=rid))

    # File scope
    if data.file_ids_by_record:
        for rid, fids in data.file_ids_by_record.items():
            for fid in fids:
                db.add(GroupShareFile(share_id=child_share.id, record_id=int(rid), file_id=fid))
    elif parent.allowed_files:
        for pf in parent.allowed_files:
            db.add(GroupShareFile(share_id=child_share.id, record_id=pf.record_id, file_id=pf.file_id))

    db.flush()

    group = db.query(ReportGroup).filter(ReportGroup.id == parent.group_id).first()
    group_title = group.title if group else "report"

    # Notify new doctor
    notification_service.create_notification(
        db, recipient_id=data.grantee_user_id,
        title="Report Access Shared With You",
        message=f"Dr. {doctor.name} shared '{group_title}' with you (delegated from patient share).",
        type=NotificationType.REPORT_SHARED,
    )
    # Notify patient
    notification_service.create_notification(
        db, recipient_id=parent.granted_by,
        title="Your Report Was Re-Shared",
        message=f"Dr. {doctor.name} delegated access to '{group_title}' to Dr. {new_doctor.name}.",
        type=NotificationType.GENERAL,
    )
    audit_service.create_log(
        db, action="GROUP_SHARE_DELEGATED", actor=doctor,
        target_type="GroupShare", target_id=child_share.id,
        details={"parent_share_id": parent.id, "to_doctor": new_doctor.name, "group_id": parent.group_id},
    )
    db.commit()
    db.refresh(child_share)
    return _enrich(db, child_share)


# ── List shares ───────────────────────────────────────────────────────────────

def list_group_shares(db: Session, group_id: int, requester: User) -> list[GroupShare]:
    group = db.query(ReportGroup).filter(ReportGroup.id == group_id).first()
    if not group:
        raise not_found("Report Group")
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    shares = db.query(GroupShare).filter(
        GroupShare.group_id == group_id, GroupShare.is_active == 1
    ).order_by(GroupShare.created_at.desc()).all()
    return [_enrich(db, s) for s in shares]


def list_doctor_shares(db: Session, doctor: User) -> list[GroupShare]:
    """Doctor's view: all pending + accepted shares targeted at them."""
    shares = db.query(GroupShare).filter(
        GroupShare.grantee_type == GroupGranteeType.USER,
        GroupShare.grantee_user_id == doctor.id,
        GroupShare.is_active == 1,
        GroupShare.status.in_([ShareStatus.PENDING, ShareStatus.ACCEPTED]),
    ).order_by(GroupShare.created_at.desc()).all()
    # Also include specialization-level shares for doctor's specialization
    if doctor.specialization_id:
        spec_shares = db.query(GroupShare).filter(
            GroupShare.grantee_type == GroupGranteeType.SPECIALIZATION,
            GroupShare.grantee_spec_id == doctor.specialization_id,
            GroupShare.is_active == 1,
            GroupShare.status.in_([ShareStatus.PENDING, ShareStatus.ACCEPTED]),
        ).order_by(GroupShare.created_at.desc()).all()
        shares = list(shares) + list(spec_shares)
    return [_enrich(db, s) for s in shares]


# ── Update share (Patient) ────────────────────────────────────────────────────

def update_group_share(db: Session, share_id: int, data: GroupShareUpdate, requester: User) -> GroupShare:
    share = db.query(GroupShare).filter(GroupShare.id == share_id, GroupShare.is_active == 1).first()
    if not share:
        raise not_found("Group Share")
    group = db.query(ReportGroup).filter(ReportGroup.id == share.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()
    share.max_versions = data.max_versions
    share.can_view = data.can_view
    share.can_download = data.can_download
    share.can_share = data.can_share
    share.can_delegate = data.can_delegate
    audit_service.create_log(
        db, action="GROUP_SHARE_UPDATED", actor=requester,
        target_type="GroupShare", target_id=share.id,
        details={"max_versions": data.max_versions, "can_download": data.can_download, "can_delegate": data.can_delegate},
    )
    db.commit()
    db.refresh(share)
    return _enrich(db, share)


# ── Revoke share (Patient) ────────────────────────────────────────────────────

def revoke_group_share(db: Session, share_id: int, requester: User) -> None:
    share = db.query(GroupShare).filter(GroupShare.id == share_id).first()
    if not share:
        raise not_found("Group Share")
    group = db.query(ReportGroup).filter(ReportGroup.id == share.group_id).first()
    if requester.role != UserRole.ADMIN and group.patient_id != requester.id:
        raise forbidden()

    _revoke_share_cascade(db, share, requester)

    # Notify doctor
    if share.grantee_type == GroupGranteeType.USER and share.grantee_user_id:
        notification_service.create_notification(
            db, recipient_id=share.grantee_user_id,
            title="Report Group Access Revoked",
            message=f"Your access to '{group.title if group else 'report'}' has been revoked.",
            type=NotificationType.SHARE_REVOKED,
        )
    audit_service.create_log(
        db, action="GROUP_SHARE_REVOKED", actor=requester,
        target_type="GroupShare", target_id=share.id,
        details={"group_id": share.group_id},
    )
    db.commit()


def _revoke_share_cascade(db: Session, share: GroupShare, actor: User) -> None:
    """Revoke a share and all its delegated children recursively."""
    share.is_active = 0
    share.status = ShareStatus.REVOKED
    share.revoked_at = datetime.utcnow()
    share.revoked_by = actor.id
    # Cascade to children
    children = db.query(GroupShare).filter(
        GroupShare.parent_share_id == share.id, GroupShare.is_active == 1
    ).all()
    for child in children:
        _revoke_share_cascade(db, child, actor)


# ── Doctor access authorization ───────────────────────────────────────────────

def get_accessible_records_for_doctor(
    db: Session, group_id: int, doctor: User
) -> list[ReportRecord] | None:
    share = _find_active_share_for_doctor(db, group_id, doctor)
    if not share:
        return None

    all_records = (
        db.query(ReportRecord)
        .filter(
            ReportRecord.group_id == group_id,
            ReportRecord.is_active == 1,
            ReportRecord.suspension_status == SuspensionStatus.ACTIVE,
        )
        .order_by(ReportRecord.record_date.desc())
        .all()
    )

    allowed_ids = _get_allowed_record_ids_for_share(db, share)
    if allowed_ids is not None:
        records = [r for r in all_records if r.id in allowed_ids]
    elif share.max_versions and share.max_versions > 0:
        records = all_records[:share.max_versions]
    else:
        records = all_records

    return records


def check_file_access(db: Session, share_id: int, record_id: int, file_id: int, doctor: User) -> bool:
    """Check if a doctor can access a specific file via a share."""
    share = _get_share_for_doctor(db, share_id, doctor)
    if share.status != ShareStatus.ACCEPTED:
        return False
    # Check record is allowed
    allowed_record_ids = _get_allowed_record_ids_for_share(db, share)
    if allowed_record_ids is not None and record_id not in allowed_record_ids:
        return False
    # Check file is allowed
    allowed_file_ids = _get_allowed_file_ids_for_record(db, share, record_id)
    if allowed_file_ids is not None and file_id not in allowed_file_ids:
        return False
    return True


def get_doctor_download_permission(db: Session, group_id: int, doctor: User) -> bool:
    """True if doctor has can_download on a GroupShare for this group."""
    share = _find_active_share_for_doctor(db, group_id, doctor)
    return share is not None and share.can_download


# ── ZIP export/import provenance ─────────────────────────────────────────────

def record_share_export(
    db: Session, share_id: int, exported_by: int, export_token: str,
    record_ids: list[int], file_ids: list[int]
) -> ShareExport:
    exp = ShareExport(
        share_id=share_id,
        exported_by=exported_by,
        export_token=export_token,
        record_ids=record_ids,
        file_ids=file_ids,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


def record_share_import(
    db: Session, imported_by: int, patient_id: int | None,
    export_token: str | None, import_metadata: dict | None
) -> ShareImport:
    # Try to find matching export by token
    export_id = None
    share_id = None
    if export_token:
        exp = db.query(ShareExport).filter(ShareExport.export_token == export_token).first()
        if exp:
            export_id = exp.id
            share_id = exp.share_id

    si = ShareImport(
        export_id=export_id,
        share_id=share_id,
        imported_by=imported_by,
        patient_id=patient_id,
        export_token=export_token,
        import_metadata=import_metadata,
    )
    db.add(si)
    db.commit()
    db.refresh(si)
    return si


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_grantee(db: Session, data: GroupShareCreate) -> tuple[str, int | None]:
    if data.grantee_type == GroupGranteeType.USER:
        if not data.grantee_user_id:
            raise bad_request("grantee_user_id required for USER type")
        grantee = db.query(User).filter(User.id == data.grantee_user_id).first()
        if not grantee or grantee.role != UserRole.DOCTOR:
            raise not_found("Grantee doctor")
        return grantee.name, data.grantee_user_id
    else:
        if not data.grantee_spec_id:
            raise bad_request("grantee_spec_id required for SPECIALIZATION type")
        from models.specialization import Specialization
        spec = db.query(Specialization).filter(
            Specialization.id == data.grantee_spec_id, Specialization.is_active == 1
        ).first()
        if not spec:
            raise not_found("Specialization")
        return spec.name, None


def _validate_record_scope(db: Session, record_ids: list[int], group_id: int) -> None:
    for rid in record_ids:
        rec = db.query(ReportRecord).filter(
            ReportRecord.id == rid, ReportRecord.group_id == group_id
        ).first()
        if not rec:
            raise bad_request(f"Record {rid} does not belong to this group.")


def _validate_file_scope(db: Session, file_ids_by_record: dict, record_ids: list[int]) -> None:
    for record_id, file_ids in file_ids_by_record.items():
        rid = int(record_id)
        if record_ids and rid not in record_ids:
            raise bad_request(f"Record {rid} is not in the selected record scope.")
        for fid in file_ids:
            f = db.query(ReportFile).filter(
                ReportFile.id == fid, ReportFile.record_id == rid
            ).first()
            if not f:
                raise bad_request(f"File {fid} does not belong to record {rid}.")


def _find_existing(db: Session, data: GroupShareCreate) -> GroupShare | None:
    q = db.query(GroupShare).filter(
        GroupShare.group_id == data.group_id,
        GroupShare.grantee_type == data.grantee_type,
        GroupShare.parent_share_id.is_(None),  # don't upsert delegated shares
    )
    if data.grantee_type == GroupGranteeType.USER:
        q = q.filter(GroupShare.grantee_user_id == data.grantee_user_id)
    else:
        q = q.filter(GroupShare.grantee_spec_id == data.grantee_spec_id)
    return q.first()


def _find_active_share_for_doctor(db: Session, group_id: int, doctor: User) -> GroupShare | None:
    share = db.query(GroupShare).filter(
        GroupShare.group_id == group_id,
        GroupShare.grantee_type == GroupGranteeType.USER,
        GroupShare.grantee_user_id == doctor.id,
        GroupShare.is_active == 1,
        GroupShare.can_view == 1,
        GroupShare.status == ShareStatus.ACCEPTED,
    ).first()
    if not share and doctor.specialization_id:
        share = db.query(GroupShare).filter(
            GroupShare.group_id == group_id,
            GroupShare.grantee_type == GroupGranteeType.SPECIALIZATION,
            GroupShare.grantee_spec_id == doctor.specialization_id,
            GroupShare.is_active == 1,
            GroupShare.can_view == 1,
            GroupShare.status == ShareStatus.ACCEPTED,
        ).first()
    return share


def _get_share_for_doctor(db: Session, share_id: int, doctor: User) -> GroupShare:
    share = db.query(GroupShare).filter(
        GroupShare.id == share_id,
        GroupShare.is_active == 1,
    ).first()
    if not share:
        raise not_found("Share")
    # Must be grantee
    if share.grantee_type == GroupGranteeType.USER:
        if share.grantee_user_id != doctor.id:
            raise forbidden()
    elif share.grantee_type == GroupGranteeType.SPECIALIZATION:
        if share.grantee_spec_id != doctor.specialization_id:
            raise forbidden()
    return share


def _get_allowed_record_ids_for_share(db: Session, share: GroupShare) -> list[int] | None:
    """Returns list of allowed record IDs, or None if all records allowed."""
    rows = db.query(GroupShareRecord).filter(GroupShareRecord.share_id == share.id).all()
    if not rows:
        return None
    return [r.record_id for r in rows]


def _get_allowed_file_ids_for_record(db: Session, share: GroupShare, record_id: int) -> list[int] | None:
    """Returns list of allowed file IDs for a record, or None if all files allowed."""
    rows = db.query(GroupShareFile).filter(
        GroupShareFile.share_id == share.id,
        GroupShareFile.record_id == record_id,
    ).all()
    if not rows:
        return None
    return [r.file_id for r in rows]


def _enrich(db: Session, share: GroupShare) -> GroupShare:
    # grantee_name
    if share.grantee_type == GroupGranteeType.USER and share.grantee_user_id:
        u = db.query(User).filter(User.id == share.grantee_user_id).first()
        share.__dict__["grantee_name"] = u.name if u else None
    elif share.grantee_type == GroupGranteeType.SPECIALIZATION and share.grantee_spec_id:
        from models.specialization import Specialization
        s = db.query(Specialization).filter(Specialization.id == share.grantee_spec_id).first()
        share.__dict__["grantee_name"] = s.name if s else None
    else:
        share.__dict__["grantee_name"] = None

    # Scope summaries
    allowed_rids = _get_allowed_record_ids_for_share(db, share)
    share.__dict__["allowed_record_ids"] = allowed_rids

    file_map: dict[int, list[int]] = {}
    if allowed_rids:
        for rid in allowed_rids:
            fids = _get_allowed_file_ids_for_record(db, share, rid)
            if fids is not None:
                file_map[rid] = fids
    share.__dict__["allowed_file_ids_by_record"] = file_map if file_map else None

    # Group/patient info
    group = db.query(ReportGroup).filter(ReportGroup.id == share.group_id).first()
    if group:
        share.__dict__["group_title"] = group.title
        patient = db.query(User).filter(User.id == group.patient_id).first()
        share.__dict__["patient_name"] = patient.name if patient else None
        share.__dict__["patient_id"] = group.patient_id
    else:
        share.__dict__["group_title"] = None
        share.__dict__["patient_name"] = None
        share.__dict__["patient_id"] = None

    return share
