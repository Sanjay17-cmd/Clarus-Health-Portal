"""Break-Glass router — enforced at API level."""
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from core.dependencies import get_active_user, require_role
from database import get_db
from models.user import User, UserRole
from schemas.break_glass import (
    BreakGlassRequestCreate, BreakGlassRequestRead,
    BreakGlassStatusResponse, BreakGlassSuspensionEventRead,
    RestoreFromSuspensionRequest,
    BgDownloadRequestCreate, BgDownloadRequestRead, BgDownloadReviewRequest,
    BgShareRequestCreate, BgShareRequestRead, BgShareReviewRequest,
)
from services import break_glass_service

router = APIRouter(tags=["break-glass"])


def _ip(request: Request) -> str | None:
    return request.headers.get("X-Forwarded-For", request.client.host if request.client else None)


# ── Doctor endpoints ───────────────────────────────────────────────────────────

@router.post("/api/break-glass/request", response_model=BreakGlassRequestRead, status_code=201)
def request_break_glass(
    data: BreakGlassRequestCreate,
    request: Request,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db)
):
    """Doctor requests emergency access to exactly one patient's records."""
    if user.role != UserRole.DOCTOR:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only doctors can request Break-Glass access.")
    req = break_glass_service.request_break_glass(db, data, user, ip=_ip(request))
    return _enrich_request(req, db)


@router.get("/api/break-glass/status/{patient_id}", response_model=BreakGlassStatusResponse)
def check_break_glass_status(
    patient_id: int,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db)
):
    """Doctor checks if they have active emergency access to a specific patient."""
    req = break_glass_service.get_active_break_glass(db, user.id, patient_id)
    if req:
        return BreakGlassStatusResponse(is_active=True, request=_enrich_request(req, db))
    return BreakGlassStatusResponse(is_active=False, request=None)


@router.get("/api/break-glass/my", response_model=list[BreakGlassRequestRead])
def my_break_glass_history(
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db)
):
    from models.break_glass import BreakGlassRequest
    reqs = db.query(BreakGlassRequest).filter(BreakGlassRequest.doctor_id == user.id).order_by(BreakGlassRequest.granted_at.desc()).all()
    return [_enrich_request(r, db) for r in reqs]


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/api/admin/break-glass", response_model=list[BreakGlassRequestRead])
def admin_list_break_glass(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    return [_enrich_request(r, db) for r in break_glass_service.list_all_break_glass(db)]


@router.get("/api/admin/break-glass/suspensions", response_model=list[BreakGlassSuspensionEventRead])
def admin_list_suspensions(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    events = break_glass_service.list_suspension_events(db)
    from models.user import User as UserModel
    result = []
    for ev in events:
        doc = db.query(UserModel).filter(UserModel.id == ev.doctor_id).first()
        result.append(BreakGlassSuspensionEventRead(
            id=ev.id, doctor_id=ev.doctor_id,
            doctor_name=doc.name if doc else None,
            trigger_count=ev.trigger_count,
            window_start=ev.window_start, window_end=ev.window_end,
            patient_ids=ev.patient_ids if isinstance(ev.patient_ids, list) else list(ev.patient_ids),
            suspended_at=ev.suspended_at, restored_by=ev.restored_by,
            restored_at=ev.restored_at, restore_notes=ev.restore_notes,
        ))
    return result


@router.post("/api/admin/break-glass/suspensions/{event_id}/restore", response_model=BreakGlassSuspensionEventRead)
def admin_restore_from_suspension(
    event_id: int,
    data: RestoreFromSuspensionRequest,
    request: Request,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    ev = break_glass_service.restore_from_suspension(db, event_id, user, data, ip=_ip(request))
    from models.user import User as UserModel
    doc = db.query(UserModel).filter(UserModel.id == ev.doctor_id).first()
    return BreakGlassSuspensionEventRead(
        id=ev.id, doctor_id=ev.doctor_id, doctor_name=doc.name if doc else None,
        trigger_count=ev.trigger_count, window_start=ev.window_start, window_end=ev.window_end,
        patient_ids=ev.patient_ids if isinstance(ev.patient_ids, list) else list(ev.patient_ids),
        suspended_at=ev.suspended_at, restored_by=ev.restored_by,
        restored_at=ev.restored_at, restore_notes=ev.restore_notes,
    )


# ── Helper ─────────────────────────────────────────────────────────────────────

def _enrich_request(req, db: Session) -> BreakGlassRequestRead:
    from models.user import User as UserModel
    doc = db.query(UserModel).filter(UserModel.id == req.doctor_id).first()
    pat = db.query(UserModel).filter(UserModel.id == req.patient_id).first()
    return BreakGlassRequestRead(
        id=req.id, doctor_id=req.doctor_id,
        doctor_name=doc.name if doc else None,
        patient_id=req.patient_id,
        patient_name=pat.name if pat else None,
        justification=req.justification, status=req.status,
        granted_at=req.granted_at, expires_at=req.expires_at,
        revoked_at=req.revoked_at,
    )


def _enrich_dl(req, db) -> BgDownloadRequestRead:
    from models.user import User as U
    from models.report import ReportGroup
    doc = db.query(U).filter(U.id == req.doctor_id).first()
    pat = db.query(U).filter(U.id == req.patient_id).first()
    grp = db.query(ReportGroup).filter(ReportGroup.id == req.group_id).first()
    return BgDownloadRequestRead(
        id=req.id, bg_request_id=req.bg_request_id,
        doctor_id=req.doctor_id, doctor_name=doc.name if doc else None,
        patient_id=req.patient_id, patient_name=pat.name if pat else None,
        group_id=req.group_id, group_title=grp.title if grp else None,
        record_ids=req.record_ids if isinstance(req.record_ids, list) else [],
        file_ids=req.file_ids if isinstance(req.file_ids, list) else [],
        reason=req.reason, status=req.status,
        reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
        review_notes=req.review_notes,
        download_performed=req.download_performed,
        downloaded_at=req.downloaded_at, created_at=req.created_at,
    )


def _enrich_sr(req, db) -> BgShareRequestRead:
    from models.user import User as U
    from models.report import ReportGroup
    rd = db.query(U).filter(U.id == req.requesting_doctor_id).first()
    rc = db.query(U).filter(U.id == req.recipient_doctor_id).first()
    pat = db.query(U).filter(U.id == req.patient_id).first()
    grp = db.query(ReportGroup).filter(ReportGroup.id == req.group_id).first()
    return BgShareRequestRead(
        id=req.id, bg_request_id=req.bg_request_id,
        requesting_doctor_id=req.requesting_doctor_id,
        requesting_doctor_name=rd.name if rd else None,
        recipient_doctor_id=req.recipient_doctor_id,
        recipient_doctor_name=rc.name if rc else None,
        patient_id=req.patient_id, patient_name=pat.name if pat else None,
        group_id=req.group_id, group_title=grp.title if grp else None,
        record_ids=req.record_ids, file_ids=req.file_ids,
        can_download=req.can_download, share_count=req.share_count,
        reason=req.reason, status=req.status,
        reviewed_by=req.reviewed_by, reviewed_at=req.reviewed_at,
        review_notes=req.review_notes, group_share_id=req.group_share_id,
        created_at=req.created_at,
    )


# ── Doctor: Download Requests ─────────────────────────────────────────────────

@router.post("/api/break-glass/download-request", response_model=BgDownloadRequestRead, status_code=201)
def create_download_request(
    data: BgDownloadRequestCreate,
    request: Request,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Doctor submits an emergency download request for admin approval."""
    from fastapi import HTTPException
    if user.role != UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="Only doctors can request emergency downloads.")
    req = break_glass_service.create_download_request(db, data, user, ip=_ip(request))
    return _enrich_dl(req, db)


@router.get("/api/break-glass/download-requests", response_model=list[BgDownloadRequestRead])
def my_download_requests(
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    reqs = break_glass_service.list_download_requests_for_doctor(db, user.id)
    return [_enrich_dl(r, db) for r in reqs]


# Download the approved file (scope-enforced)
@router.get("/api/break-glass/download/{req_id}/file/{file_id}")
def perform_download(
    req_id: int,
    file_id: int,
    request: Request,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Stream approved file. Backend verifies scope before serving."""
    from fastapi import HTTPException
    from storage.service import StorageService
    from models.report import ReportFile
    if user.role != UserRole.DOCTOR:
        raise HTTPException(status_code=403)
    break_glass_service.perform_approved_download(db, req_id, file_id, user, ip=_ip(request))
    rf = db.query(ReportFile).filter(ReportFile.id == file_id).first()
    if not rf:
        raise HTTPException(status_code=404)
    data = StorageService.read(rf.storage_path)
    return Response(
        content=data,
        media_type=rf.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{rf.original_name}"'},
    )


# ── Doctor: Emergency Share Chain ─────────────────────────────────────────────

@router.post("/api/break-glass/share", status_code=201)
def request_emergency_share(
    data: BgShareRequestCreate,
    request: Request,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException
    if user.role != UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="Only doctors can share emergency records.")
    result = break_glass_service.request_emergency_share(db, data, user, ip=_ip(request))
    sr = result["share_request"]
    return {
        "status": result["status"],
        "requires_admin": result["requires_admin"],
        "share_request": _enrich_sr(sr, db),
    }


@router.get("/api/break-glass/share-requests", response_model=list[BgShareRequestRead])
def my_share_requests(
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    reqs = break_glass_service.list_share_requests_for_doctor(db, user.id)
    return [_enrich_sr(r, db) for r in reqs]


# ── Admin: Download Approvals ────────────────────────────────────────────────

@router.get("/api/admin/break-glass/download-requests", response_model=list[BgDownloadRequestRead])
def admin_list_download_requests(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    reqs = break_glass_service.list_all_download_requests(db)
    return [_enrich_dl(r, db) for r in reqs]


@router.post("/api/admin/break-glass/download-requests/{req_id}/review", response_model=BgDownloadRequestRead)
def admin_review_download_request(
    req_id: int,
    data: BgDownloadReviewRequest,
    request: Request,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    req = break_glass_service.review_download_request(db, req_id, data, user, ip=_ip(request))
    return _enrich_dl(req, db)


# ── Admin: Share Chain Approvals ─────────────────────────────────────────────

@router.get("/api/admin/break-glass/share-requests", response_model=list[BgShareRequestRead])
def admin_list_share_requests(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    reqs = break_glass_service.list_all_share_requests(db)
    return [_enrich_sr(r, db) for r in reqs]


@router.post("/api/admin/break-glass/share-requests/{req_id}/review", response_model=BgShareRequestRead)
def admin_review_share_request(
    req_id: int,
    data: BgShareReviewRequest,
    request: Request,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    req = break_glass_service.review_share_request(db, req_id, data, user, ip=_ip(request))
    return _enrich_sr(req, db)
