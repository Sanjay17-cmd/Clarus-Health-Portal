"""Report service — Phase 1+2+3A (suspension-aware, correction-enforced)."""
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy.orm import Session, joinedload
from config import settings
from core.exceptions import bad_request, forbidden, not_found
from models.notification import NotificationType
from models.report import ReportFile, ReportGroup, ReportRecord, RecordType, SuspensionStatus
from models.user import User, UserRole, UserStatus
from schemas.report import ReportGroupCreate, ReportRecordCreate
from services import audit_service, notification_service
from storage.service import storage

ALLOWED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}


def list_patients(db, search=None):
    q = db.query(User).filter(User.role == UserRole.PATIENT, User.status == UserStatus.ACTIVE)
    if search:
        like = f"%{search}%"
        q = q.filter((User.name.ilike(like)) | (User.email.ilike(like)))
    return q.order_by(User.name).limit(200).all()


def create_group(db, data, patient_id, creator):
    patient = db.query(User).filter(User.id == patient_id, User.role == UserRole.PATIENT, User.status == UserStatus.ACTIVE).first()
    if not patient:
        raise not_found("Patient")
    group = ReportGroup(patient_id=patient_id, title=data.title, test_type=data.test_type, description=data.description, created_by=creator.id)
    db.add(group)
    db.flush()
    audit_service.create_log(db, action="REPORT_GROUP_CREATED", actor=creator, target_type="ReportGroup", target_id=group.id, details={"title": data.title, "patient_id": patient_id})
    db.commit()
    db.refresh(group)
    return group


def get_groups_for_patient(db, patient_id):
    groups = db.query(ReportGroup).filter(ReportGroup.patient_id == patient_id, ReportGroup.is_active == 1).options(joinedload(ReportGroup.records)).order_by(ReportGroup.created_at.desc()).all()
    result = []
    for g in groups:
        active = [r for r in g.records if r.is_active and r.suspension_status == SuspensionStatus.ACTIVE]
        latest = max((r.record_date for r in active), default=None)
        result.append({"id": g.id, "patient_id": g.patient_id, "title": g.title, "test_type": g.test_type, "description": g.description, "is_active": bool(g.is_active), "created_by": g.created_by, "created_at": g.created_at, "updated_at": g.updated_at, "record_count": len(active), "latest_record_date": latest})
    return result


def get_group_by_id(db, group_id):
    g = db.query(ReportGroup).filter(ReportGroup.id == group_id).first()
    if not g:
        raise not_found("Report Group")
    return g


def create_record(db, group, data, files, technician):
    if not files:
        raise bad_request("At least one file must be uploaded")
    if data.record_type == RecordType.CORRECTION:
        if data.corrects_record_id is None:
            raise bad_request("CORRECTION requires corrects_record_id")
        original = db.query(ReportRecord).filter(ReportRecord.id == data.corrects_record_id, ReportRecord.group_id == group.id, ReportRecord.is_active == 1, ReportRecord.suspension_status == SuspensionStatus.ACTIVE).first()
        if not original:
            raise not_found("Original record to correct (must be active and in the same group)")

    record = ReportRecord(group_id=group.id, record_type=data.record_type, corrects_record_id=data.corrects_record_id, record_date=data.record_date, notes=data.notes, lab_technician_id=technician.id, lab_technician_name=technician.name)
    db.add(record)
    db.flush()

    for idx, upload in enumerate(files):
        file_bytes = upload.file.read()
        mime = upload.content_type or "application/octet-stream"
        if mime not in ALLOWED_MIME_TYPES:
            db.rollback()
            raise bad_request(f"File type '{mime}' not allowed")
        if len(file_bytes) > settings.max_file_size_bytes:
            db.rollback()
            raise bad_request(f"File too large (max {settings.MAX_FILE_SIZE_MB} MB)")
        stored_path = storage.generate_path(upload.filename or "file")
        storage.save(file_bytes, stored_path)
        db.add(ReportFile(record_id=record.id, original_name=upload.filename or "file", stored_path=stored_path, mime_type=mime, file_size=len(file_bytes), sort_order=idx, uploaded_by=technician.id))

    audit_service.create_log(db, action="REPORT_RECORD_CREATED", actor=technician, target_type="ReportRecord", target_id=record.id, details={"group_id": group.id, "record_type": data.record_type.value, "file_count": len(files)})

    # Notify patient of correction
    if data.record_type == RecordType.CORRECTION:
        notification_service.create_notification(db, recipient_id=group.patient_id, title="Report Correction Uploaded", message=f"A correction was added to '{group.title}' by {technician.name}.", type=NotificationType.CORRECTION_CREATED)

    db.commit()
    db.refresh(record)
    return record


def get_records_for_group(db, group_id, viewer):
    group = get_group_by_id(db, group_id)
    if viewer.role == UserRole.PATIENT:
        if group.patient_id != viewer.id:
            raise forbidden()
    elif viewer.role == UserRole.DOCTOR:
        _assert_doctor_access(db, group_id, viewer)
    elif viewer.role not in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        raise forbidden()

    records = (db.query(ReportRecord).options(joinedload(ReportRecord.files)).filter(ReportRecord.group_id == group_id, ReportRecord.is_active == 1, ReportRecord.suspension_status == SuspensionStatus.ACTIVE).order_by(ReportRecord.record_date.desc()).all())
    # Enrich with corrects_record_date
    for r in records:
        if r.corrects_record_id:
            orig = db.query(ReportRecord.record_date).filter(ReportRecord.id == r.corrects_record_id).first()
            r.__dict__["corrects_record_date"] = orig[0] if orig else None
        else:
            r.__dict__["corrects_record_date"] = None
    return records


def get_record_by_id(db, record_id, viewer):
    record = db.query(ReportRecord).options(joinedload(ReportRecord.files)).filter(ReportRecord.id == record_id, ReportRecord.is_active == 1, ReportRecord.suspension_status == SuspensionStatus.ACTIVE).first()
    if not record:
        raise not_found("Report Record")
    group = get_group_by_id(db, record.group_id)
    _assert_can_view(db, record, group, viewer)
    audit_service.create_log(db, action="REPORT_RECORD_VIEWED", actor=viewer, target_type="ReportRecord", target_id=record.id, details={"group_id": record.group_id})
    db.commit()
    return record


def get_file_for_view(db, file_id, viewer):
    rf = _get_active_file(db, file_id)
    record, group = rf.record, rf.record.group
    _assert_can_view(db, record, group, viewer)
    data = storage.read(rf.stored_path)
    audit_service.create_log(db, action="FILE_VIEWED", actor=viewer, target_type="ReportFile", target_id=rf.id, details={"record_id": record.id, "original_name": rf.original_name})
    # Notify patient if technician is viewing
    if viewer.role == UserRole.LAB_TECHNICIAN:
        notification_service.create_notification(db, recipient_id=group.patient_id, title="Report Viewed by Lab Technician", message=f"Lab Technician {viewer.name} viewed your {group.title} report.", type=NotificationType.TECHNICIAN_VIEWED)
    db.commit()
    return rf, data


def get_file_for_download(db, file_id, viewer):
    rf = _get_active_file(db, file_id)
    record, group = rf.record, rf.record.group
    if viewer.role == UserRole.PATIENT and group.patient_id == viewer.id:
        pass  # always allowed
    elif viewer.role == UserRole.ADMIN:
        pass
    elif viewer.role == UserRole.LAB_TECHNICIAN:
        pass
    elif viewer.role == UserRole.DOCTOR:
        if not _doctor_can_download(db, record, group, viewer):
            raise forbidden("You do not have download permission for this record")
    else:
        raise forbidden()
    data = storage.read(rf.stored_path)
    audit_service.create_log(db, action="FILE_DOWNLOADED", actor=viewer, target_type="ReportFile", target_id=rf.id, details={"record_id": record.id})
    if viewer.role == UserRole.DOCTOR:
        notification_service.create_notification(db, recipient_id=group.patient_id, title="Report Downloaded by Doctor", message=f"Dr. {viewer.name} downloaded a file from '{group.title}'.", type=NotificationType.DOCTOR_DOWNLOADED)
    db.commit()
    return rf, data


def get_groups_accessible_to_doctor(db, doctor):
    from models.share import ReportPermission, GranteeType
    from models.group_share import GroupShare, GroupGranteeType
    from sqlalchemy import or_

    # Via GroupShare — only ACCEPTED shares (Phase 4)
    from models.group_share import ShareStatus
    gs_q = db.query(GroupShare).filter(
        GroupShare.is_active == 1, GroupShare.can_view == 1,
        GroupShare.status == ShareStatus.ACCEPTED
    )
    if doctor.specialization_id:
        gs_q = gs_q.filter(or_((GroupShare.grantee_type == GroupGranteeType.USER) & (GroupShare.grantee_user_id == doctor.id), (GroupShare.grantee_type == GroupGranteeType.SPECIALIZATION) & (GroupShare.grantee_spec_id == doctor.specialization_id)))
    else:
        gs_q = gs_q.filter(GroupShare.grantee_type == GroupGranteeType.USER, GroupShare.grantee_user_id == doctor.id)
    group_ids_gs = {gs.group_id for gs in gs_q.all()}

    # Via per-record permission
    rp_q = db.query(ReportPermission).filter(ReportPermission.can_view == 1)
    if doctor.specialization_id:
        rp_q = rp_q.filter(or_((ReportPermission.grantee_type == GranteeType.USER) & (ReportPermission.grantee_user_id == doctor.id), (ReportPermission.grantee_type == GranteeType.SPECIALIZATION) & (ReportPermission.grantee_spec_id == doctor.specialization_id)))
    else:
        rp_q = rp_q.filter(ReportPermission.grantee_type == GranteeType.USER, ReportPermission.grantee_user_id == doctor.id)
    record_ids_perm = {p.record_id for p in rp_q.all()}
    if record_ids_perm:
        recs = db.query(ReportRecord).filter(ReportRecord.id.in_(record_ids_perm)).all()
        group_ids_rp = {r.group_id for r in recs}
    else:
        group_ids_rp = set()

    all_group_ids = group_ids_gs | group_ids_rp
    if not all_group_ids:
        return []

    groups = db.query(ReportGroup).options(joinedload(ReportGroup.records)).filter(ReportGroup.id.in_(all_group_ids), ReportGroup.is_active == 1).all()
    result = []
    for g in groups:
        from services.group_share_service import get_accessible_records_for_doctor
        gs_recs = get_accessible_records_for_doctor(db, g.id, doctor)
        if gs_recs is not None:
            active = gs_recs
        else:
            active = [r for r in g.records if r.is_active and r.suspension_status == SuspensionStatus.ACTIVE and r.id in record_ids_perm]
        latest = max((r.record_date for r in active), default=None)
        result.append({"id": g.id, "patient_id": g.patient_id, "title": g.title, "test_type": g.test_type, "description": g.description, "is_active": bool(g.is_active), "created_by": g.created_by, "created_at": g.created_at, "updated_at": g.updated_at, "record_count": len(active), "latest_record_date": latest})
    return result


def get_technician_uploads(db, technician, limit=100):
    records = (db.query(ReportRecord).options(joinedload(ReportRecord.files), joinedload(ReportRecord.group)).filter(ReportRecord.lab_technician_id == technician.id, ReportRecord.is_active == 1).order_by(ReportRecord.created_at.desc()).limit(limit).all())
    return records


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_active_file(db, file_id):
    rf = db.query(ReportFile).options(joinedload(ReportFile.record).joinedload(ReportRecord.group)).filter(ReportFile.id == file_id, ReportFile.is_active == 1).first()
    if not rf:
        raise not_found("Report File")
    return rf


def _assert_can_view(db, record, group, viewer):
    if viewer.role in (UserRole.ADMIN, UserRole.LAB_TECHNICIAN):
        return
    if viewer.role == UserRole.PATIENT and group.patient_id == viewer.id:
        return
    if viewer.role == UserRole.DOCTOR:
        # Group share
        from services.group_share_service import get_accessible_records_for_doctor
        gs_recs = get_accessible_records_for_doctor(db, record.group_id, viewer)
        if gs_recs is not None and any(r.id == record.id for r in gs_recs):
            return
        # Per-record perm
        perm = _find_perm(db, record.id, viewer)
        if perm and perm.can_view:
            return
        raise forbidden("You do not have access to this record")
    raise forbidden()


def _doctor_can_download(db, record, group, doctor):
    from services.group_share_service import get_doctor_download_permission
    if get_doctor_download_permission(db, group.id, doctor):
        return True
    perm = _find_perm(db, record.id, doctor)
    return perm is not None and perm.can_download


def _find_perm(db, record_id, doctor):
    from models.share import ReportPermission, GranteeType
    p = db.query(ReportPermission).filter(ReportPermission.record_id == record_id, ReportPermission.grantee_type == GranteeType.USER, ReportPermission.grantee_user_id == doctor.id).first()
    if p:
        return p
    if doctor.specialization_id:
        p = db.query(ReportPermission).filter(ReportPermission.record_id == record_id, ReportPermission.grantee_type == GranteeType.SPECIALIZATION, ReportPermission.grantee_spec_id == doctor.specialization_id).first()
    return p


def _assert_doctor_access(db, group_id, doctor):
    from models.share import ReportPermission, GranteeType
    from models.group_share import GroupShare, GroupGranteeType
    from sqlalchemy import or_
    # Group share
    from models.group_share import ShareStatus
    gs = db.query(GroupShare).filter(
        GroupShare.group_id == group_id, GroupShare.is_active == 1,
        GroupShare.can_view == 1, GroupShare.status == ShareStatus.ACCEPTED
    )
    if doctor.specialization_id:
        gs = gs.filter(or_((GroupShare.grantee_type == GroupGranteeType.USER) & (GroupShare.grantee_user_id == doctor.id), (GroupShare.grantee_type == GroupGranteeType.SPECIALIZATION) & (GroupShare.grantee_spec_id == doctor.specialization_id)))
    else:
        gs = gs.filter(GroupShare.grantee_type == GroupGranteeType.USER, GroupShare.grantee_user_id == doctor.id)
    if gs.first():
        return
    # Per-record perm
    rids = [r.id for r in db.query(ReportRecord.id).filter(ReportRecord.group_id == group_id, ReportRecord.is_active == 1).all()]
    if rids:
        perm = db.query(ReportPermission).filter(ReportPermission.record_id.in_(rids), ReportPermission.can_view == 1, or_((ReportPermission.grantee_type == GranteeType.USER) & (ReportPermission.grantee_user_id == doctor.id), (ReportPermission.grantee_type == GranteeType.SPECIALIZATION) & (ReportPermission.grantee_spec_id == doctor.specialization_id))).first()
        if perm:
            return
    raise forbidden("You do not have access to this report group")
