"""Reports router — Phase 3A: deletion requests, technician uploads added."""
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from core.dependencies import get_active_user
from database import get_db
from models.user import User, UserRole
from schemas.report import PatientBrief, ReportGroupCreate, ReportGroupRead, ReportRecordRead
from services import report_service, deletion_service
from schemas.deletion import DeletionRequestCreate, DeletionRequestRead

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/patients", response_model=list[PatientBrief])
def list_patients(search: str | None = Query(None), user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if user.role not in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        from core.exceptions import forbidden
        raise forbidden()
    return report_service.list_patients(db, search=search)


@router.post("/groups", response_model=ReportGroupRead, status_code=201)
def create_group(patient_id: int = Form(...), title: str = Form(...), test_type: str = Form(...), description: str | None = Form(None), user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if user.role not in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        from core.exceptions import forbidden
        raise forbidden()
    data = ReportGroupCreate(title=title, test_type=test_type, description=description)
    group = report_service.create_group(db, data, patient_id=patient_id, creator=user)
    rows = report_service.get_groups_for_patient(db, group.patient_id)
    for r in rows:
        if r["id"] == group.id:
            return r
    return group


@router.get("/groups", response_model=list[ReportGroupRead])
def list_groups(patient_id: int | None = Query(None), user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if user.role == UserRole.PATIENT:
        return report_service.get_groups_for_patient(db, user.id)
    elif user.role == UserRole.DOCTOR:
        return report_service.get_groups_accessible_to_doctor(db, user)
    elif user.role in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        if not patient_id:
            from core.exceptions import bad_request
            raise bad_request("patient_id required")
        return report_service.get_groups_for_patient(db, patient_id)
    from core.exceptions import forbidden
    raise forbidden()


@router.get("/groups/{group_id}/records", response_model=list[ReportRecordRead])
def list_records(group_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return report_service.get_records_for_group(db, group_id, viewer=user)


@router.post("/groups/{group_id}/records", response_model=ReportRecordRead, status_code=201)
async def create_record(
    group_id: int,
    record_type: str = Form("ORIGINAL"),
    record_date: str = Form(...),
    notes: str | None = Form(None),
    corrects_record_id: int | None = Form(None),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    if user.role not in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        from core.exceptions import forbidden
        raise forbidden()
    from datetime import datetime
    from models.report import RecordType
    from schemas.report import ReportRecordCreate
    try:
        rt = RecordType(record_type)
    except ValueError:
        from core.exceptions import bad_request
        raise bad_request(f"Invalid record_type: {record_type}")
    try:
        rd = datetime.fromisoformat(record_date.replace("Z", "+00:00"))
    except ValueError:
        from core.exceptions import bad_request
        raise bad_request("Invalid record_date format")
    group = report_service.get_group_by_id(db, group_id)
    data = ReportRecordCreate(record_type=rt, corrects_record_id=corrects_record_id, record_date=rd, notes=notes)
    return report_service.create_record(db, group, data, files, technician=user)


@router.get("/records/{record_id}", response_model=ReportRecordRead)
def get_record(record_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return report_service.get_record_by_id(db, record_id, viewer=user)


@router.get("/files/{file_id}/view")
def view_file(file_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    rf, data = report_service.get_file_for_view(db, file_id, viewer=user)
    # Log access event for doctors/patients viewing files
    try:
        from models.access_event import RecordAccessEvent
        from models.report import ReportRecord
        record = db.query(ReportRecord).filter(ReportRecord.id == rf.record_id).first()
        if record:
            ev = RecordAccessEvent(
                patient_id=record.group.patient_id if record.group else None,
                actor_id=user.id,
                actor_role=user.role.value,
                event_type="VIEWED",
                record_id=rf.record_id,
                group_id=record.group_id,
            )
            db.add(ev)
            db.commit()
    except Exception:
        pass  # Never block view due to logging error
    return Response(content=data, media_type=rf.mime_type, headers={"Content-Disposition": f'inline; filename="{rf.original_name}"', "Cache-Control": "no-store"})


@router.get("/files/{file_id}/download")
def download_file(file_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    # Phase 3B: block download for emergency-access-only doctors
    if user.role == UserRole.DOCTOR:
        from models.report import ReportFile
        rf_check = db.query(ReportFile).filter(ReportFile.id == file_id).first()
        if rf_check:
            from models.report import ReportRecord, ReportGroup
            record = db.query(ReportRecord).filter(ReportRecord.id == rf_check.record_id).first()
            group = db.query(ReportGroup).filter(ReportGroup.id == record.group_id).first() if record else None
            if group:
                from services.break_glass_service import get_active_break_glass
                from services.group_share_service import get_doctor_download_permission
                can_normal_download = get_doctor_download_permission(db, group.id, user)
                if not can_normal_download:
                    bg = get_active_break_glass(db, user.id, group.patient_id)
                    if bg:
                        from fastapi import HTTPException
                        raise HTTPException(status_code=403, detail="Downloads are not permitted during emergency Break-Glass access.")

    rf, data = report_service.get_file_for_download(db, file_id, viewer=user)
    # Log download event
    try:
        from models.access_event import RecordAccessEvent
        from models.report import ReportRecord
        record = db.query(ReportRecord).filter(ReportRecord.id == rf.record_id).first()
        if record:
            ev = RecordAccessEvent(
                patient_id=record.group.patient_id if record.group else None,
                actor_id=user.id,
                actor_role=user.role.value,
                event_type="DOWNLOADED",
                record_id=rf.record_id,
                group_id=record.group_id,
            )
            db.add(ev)
            db.commit()
    except Exception:
        pass
    return Response(content=data, media_type=rf.mime_type, headers={"Content-Disposition": f'attachment; filename="{rf.original_name}"'})



# ── Phase 3A: deletion request ─────────────────────────────────────────────
@router.post("/records/{record_id}/delete-request", status_code=201)
def request_deletion(record_id: int, body: DeletionRequestCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    body.record_id = record_id
    return deletion_service.request_deletion(db, record_id=record_id, reason=body.reason, requester=user)


# ── Phase 3A: technician uploads ──────────────────────────────────────────────
@router.get("/technician/uploads", response_model=list[ReportRecordRead])
def technician_uploads(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    if user.role not in (UserRole.LAB_TECHNICIAN, UserRole.ADMIN):
        from core.exceptions import forbidden
        raise forbidden()
    return report_service.get_technician_uploads(db, user)
