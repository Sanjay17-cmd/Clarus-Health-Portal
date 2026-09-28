"""Report service — Phase 1+2+3A (suspension-aware, correction-enforced)."""
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy import inspect
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
    if viewer.role == UserRole.DOCTOR:
        records = [record for record in records if _doctor_can_view_record(db, record, group, viewer)]
        for record in records:
            record.files = [file for file in record.files if _doctor_can_view_file(db, record, file.id, viewer)]
    _attach_archive_metadata(db, group_id, records)
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
    if viewer.role == UserRole.DOCTOR:
        record.files = [file for file in record.files if _doctor_can_view_file(db, record, file.id, viewer)]
    audit_service.create_log(db, action="REPORT_RECORD_VIEWED", actor=viewer, target_type="ReportRecord", target_id=record.id, details={"group_id": record.group_id})
    db.commit()
    return record


def get_file_for_view(db, file_id, viewer):
    rf = _get_active_file(db, file_id)
    record, group = rf.record, rf.record.group
    _assert_can_view(db, record, group, viewer)
    if viewer.role == UserRole.DOCTOR and not _doctor_can_view_file(db, record, rf.id, viewer):
        raise forbidden("You do not have access to this file")
    data = storage.read(rf.stored_path)
    audit_service.create_log(db, action="FILE_VIEWED", actor=viewer, target_type="ReportFile", target_id=rf.id, details={"record_id": record.id, "original_name": rf.original_name})
    if viewer.role == UserRole.DOCTOR:
        archive_metadata = _get_archive_metadata_for_records(db, group.id, [record]).get(record.id)
        if archive_metadata:
            source_name = (archive_metadata.get("exported_by") or {}).get("name") or "an unknown doctor"
            importing_doctor = (archive_metadata.get("imported_by") or {}).get("name") or "another doctor"
            notification_service.create_notification(
                db,
                recipient_id=group.patient_id,
                title="A Doctor Viewed a ZIP-Imported Report",
                message=(f"Dr. {viewer.name} opened and viewed '{group.title}' from a ZIP archive originally exported by "
                         f"{source_name}. The archive was imported by {importing_doctor}."),
                type=NotificationType.DOCTOR_VIEWED,
            )
    # Notify patient if technician is viewing
    if viewer.role == UserRole.LAB_TECHNICIAN:
        notification_service.create_notification(db, recipient_id=group.patient_id, title="Report Viewed by Lab Technician", message=f"Lab Technician {viewer.name} viewed your {group.title} report.", type=NotificationType.TECHNICIAN_VIEWED)
    db.commit()
    return rf, data


def _attach_archive_metadata(db, group_id, records):
    if records:
        metadata_by_record = _get_archive_metadata_for_records(db, group_id, records)
        for record in records:
            record.__dict__["archive_metadata"] = metadata_by_record.get(record.id)


def get_archive_metadata_for_record(db, record) -> dict | None:
    return _get_archive_metadata_for_records(db, record.group_id, [record]).get(record.id)


def _get_archive_metadata_for_records(db, group_id, records) -> dict[int, dict]:
    if not records:
        return {}
    from models.group_share import ShareImport

    record_ids = {record.id for record in records}
    result = {}

    def attach_source(source, import_mapping, imported_ids, imported_by, imported_at):
        if import_mapping.get("group_id") != group_id:
            return
        imported_ids = [int(value) for value in (imported_ids or [])]
        matching_records = record_ids.intersection(imported_ids)
        if not matching_records:
            return
        source_records = source.get("records") or []
        files = source.get("files") or []
        exported_by = source.get("exported_by") or {}
        for index, imported_record_id in enumerate(imported_ids):
            if imported_record_id not in matching_records or imported_record_id in result:
                continue
            source_record = source_records[index] if index < len(source_records) else {}
            original_record_id = source_record.get("id")
            record_files = [item for item in files if str(item.get("record_id")) == str(original_record_id)]
            result[imported_record_id] = {
                "clarus_export_version": source.get("clarus_export_version"),
                "export_id": source.get("export_id") or zip_import.original_export_id,
                "export_token": source.get("export_token"),
                "exported_at": source.get("exported_at"),
                "exported_by": exported_by,
                "imported_at": imported_at,
                "imported_by": import_mapping.get("imported_by") or imported_by,
                "patient": source.get("patient"),
                "report_group": source.get("report_group"),
                "lab_technician": source.get("lab_technician"),
                "record": source_record,
                "files": record_files,
            }

    patient_id = db.query(ReportGroup.patient_id).filter(ReportGroup.id == group_id).scalar()
    share_imports = db.query(ShareImport).filter(ShareImport.patient_id == patient_id).order_by(ShareImport.created_at.desc()).all()
    for source_import in share_imports:
        source = source_import.import_metadata if isinstance(source_import.import_metadata, dict) else {}
        import_mapping = source.get("_clarus_import") or {}
        if import_mapping:
            attach_source(source, import_mapping, import_mapping.get("record_ids_imported"),
                          source_import.importer.name if source_import.importer else None,
                          source_import.created_at.isoformat() if source_import.created_at else None)

    if len(result) < len(record_ids) and "group_id" in {column["name"] for column in inspect(db.get_bind()).get_columns("zip_imports")}:
        from models.archive import ZipImport
        imports = db.query(ZipImport).filter(ZipImport.group_id == group_id).order_by(ZipImport.created_at.desc()).all()
        for zip_import in imports:
            imported_ids = [int(value) for value in (zip_import.record_ids_imported or [])]
            source_import = next((item for item in share_imports if
                item.imported_by == zip_import.imported_by and
                item.patient_id == zip_import.patient_id and
                item.export_token == zip_import.original_export_id), None)
            source = source_import.import_metadata if source_import and isinstance(source_import.import_metadata, dict) else {}
            import_mapping = {
                "group_id": group_id,
                "imported_by": {"id": zip_import.imported_by, "name": zip_import.importer.name if zip_import.importer else None},
            }
            attach_source(source, import_mapping, imported_ids,
                          import_mapping["imported_by"],
                          zip_import.created_at.isoformat() if zip_import.created_at else None)
    return result


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
        _assert_can_view(db, record, group, viewer)
        if not _doctor_can_view_file(db, record, rf.id, viewer):
            raise forbidden("You do not have access to this file")
        from services.break_glass_service import consume_download_permission
        if not consume_download_permission(db, viewer, group.id):
            raise forbidden("Administrator approval is required for every doctor download")
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
    result = []
    if all_group_ids:
        groups = db.query(ReportGroup).options(joinedload(ReportGroup.records)).filter(ReportGroup.id.in_(all_group_ids), ReportGroup.is_active == 1).all()
        for g in groups:
            from services.group_share_service import get_accessible_records_for_doctor
            gs_recs = get_accessible_records_for_doctor(db, g.id, doctor)
            if gs_recs is not None:
                active = gs_recs
            else:
                active = [r for r in g.records if r.is_active and r.suspension_status == SuspensionStatus.ACTIVE and r.id in record_ids_perm]
            latest = max((r.record_date for r in active), default=None)
            result.append({"id": g.id, "patient_id": g.patient_id, "title": g.title, "test_type": g.test_type, "description": g.description, "is_active": bool(g.is_active), "created_by": g.created_by, "created_at": g.created_at, "updated_at": g.updated_at, "record_count": len(active), "latest_record_date": latest})

    from models.break_glass import BreakGlassRequest, BreakGlassShare, BreakGlassStatus
    now = datetime.utcnow()
    emergency_requests = db.query(BreakGlassRequest).filter(
        BreakGlassRequest.doctor_id == doctor.id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
        BreakGlassRequest.expires_at > now,
    ).all()
    emergency_request_by_group = {}
    if emergency_requests:
        patient_ids = {req.patient_id for req in emergency_requests}
        emergency_groups = db.query(ReportGroup).options(joinedload(ReportGroup.records)).filter(
            ReportGroup.patient_id.in_(patient_ids), ReportGroup.is_active == 1).all()
        request_by_patient = {req.patient_id: req for req in emergency_requests}
        for group in emergency_groups:
            emergency_request_by_group[group.id] = request_by_patient[group.patient_id]

    received_shares = db.query(BreakGlassShare).join(BreakGlassRequest).filter(
        BreakGlassShare.recipient_id == doctor.id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
        BreakGlassRequest.expires_at > now,
    ).all()
    for share in received_shares:
        request = db.query(BreakGlassRequest).filter(BreakGlassRequest.id == share.request_id).first()
        if request:
            emergency_request_by_group.setdefault(share.group_id, request)

    existing_group_ids = {item["id"] for item in result}
    missing_emergency_ids = set(emergency_request_by_group) - existing_group_ids
    if missing_emergency_ids:
        groups = db.query(ReportGroup).options(joinedload(ReportGroup.records)).filter(
            ReportGroup.id.in_(missing_emergency_ids), ReportGroup.is_active == 1).all()
        for group in groups:
            active = [r for r in group.records if r.is_active and r.suspension_status == SuspensionStatus.ACTIVE]
            request = emergency_request_by_group[group.id]
            result.append({"id": group.id, "patient_id": group.patient_id, "title": group.title,
                "test_type": group.test_type, "description": group.description, "is_active": bool(group.is_active),
                "created_by": group.created_by, "created_at": group.created_at, "updated_at": group.updated_at,
                "record_count": len(active), "latest_record_date": max((r.record_date for r in active), default=None),
                "emergency_access": True, "break_glass_request_id": request.id,
                "break_glass_doctor_id": request.doctor_id,
                "can_emergency_share": request.doctor_id == doctor.id})
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
        if _doctor_can_view_record(db, record, group, viewer):
            return
        raise forbidden("You do not have access to this record")
    raise forbidden()


def _doctor_can_view_record(db, record, group, doctor):
    from services.break_glass_service import get_active_access
    if get_active_access(db, doctor.id, group.patient_id, group.id):
        return True
    from services.group_share_service import get_accessible_records_for_doctor
    shared_records = get_accessible_records_for_doctor(db, record.group_id, doctor)
    if shared_records is not None and any(item.id == record.id for item in shared_records):
        return True
    permission = _find_perm(db, record.id, doctor)
    return bool(permission and permission.can_view)


def _doctor_can_view_file(db, record, file_id, doctor):
    if not _doctor_can_view_record(db, record, record.group, doctor):
        return False
    from services.break_glass_service import get_active_access
    if get_active_access(db, doctor.id, record.group.patient_id, record.group_id):
        return True
    from services.group_share_service import (
        _find_active_share_for_doctor,
        _get_allowed_file_ids_for_record,
        get_accessible_records_for_doctor,
    )
    share = _find_active_share_for_doctor(db, record.group_id, doctor)
    if share:
        records = get_accessible_records_for_doctor(db, record.group_id, doctor)
        if records is not None and any(item.id == record.id for item in records):
            allowed_file_ids = _get_allowed_file_ids_for_record(db, share, record.id)
            if allowed_file_ids is None or file_id in allowed_file_ids:
                return True
    permission = _find_perm(db, record.id, doctor)
    return bool(permission and permission.can_view)


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
    group = get_group_by_id(db, group_id)
    from services.break_glass_service import get_active_access
    if get_active_access(db, doctor.id, group.patient_id, group.id):
        return
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
