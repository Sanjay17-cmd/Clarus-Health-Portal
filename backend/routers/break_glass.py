"""Break-Glass router — enforced at API level."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from core.dependencies import get_active_user, require_role
from database import get_db
from models.user import User, UserRole
from schemas.break_glass import (
    BreakGlassRequestCreate, BreakGlassRequestRead,
    BreakGlassStatusResponse, BreakGlassSuspensionEventRead,
    RestoreFromSuspensionRequest
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
