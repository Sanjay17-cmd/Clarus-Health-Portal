"""Emergency access and administrator permission endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.dependencies import get_active_user, require_role
from database import get_db
from models.user import User, UserRole
from schemas.break_glass import AdminPermissionDecision, BreakGlassRequestCreate, BreakGlassShareCreate, DownloadPermissionRequestCreate
from services import break_glass_service

router = APIRouter(tags=["break-glass"])


@router.get("/api/break-glass/patients")
def search_patients(search: str | None = Query(None, min_length=1), user: User = Depends(require_role(UserRole.DOCTOR)), db: Session = Depends(get_db)):
    return [{"id": p.id, "name": p.name, "email": p.email} for p in break_glass_service.search_patients(db, search)]


@router.get("/api/break-glass/doctors")
def list_doctors(user: User = Depends(require_role(UserRole.DOCTOR)), db: Session = Depends(get_db)):
    return [{"id": doctor.id, "name": doctor.name, "email": doctor.email} for doctor in break_glass_service.list_doctors(db)]


@router.post("/api/break-glass/request", status_code=201)
def request_break_glass(data: BreakGlassRequestCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    req = break_glass_service.request_break_glass(db, data, user)
    return {"id": req.id, "doctor_id": req.doctor_id, "patient_id": req.patient_id, "expires_at": req.expires_at, "status": req.status.value}


@router.post("/api/break-glass/share", status_code=201)
def share_during_emergency(data: BreakGlassShareCreate, user: User = Depends(require_role(UserRole.DOCTOR)), db: Session = Depends(get_db)):
    return break_glass_service.share_during_emergency(db, data, user)


@router.post("/api/permissions/download-request", status_code=201)
def request_download_permission(data: DownloadPermissionRequestCreate, user: User = Depends(require_role(UserRole.DOCTOR)), db: Session = Depends(get_db)):
    return break_glass_service.request_download_permission(db, data.group_id, data.justification, user)


@router.get("/api/admin/permissions", dependencies=[Depends(require_role(UserRole.ADMIN))])
def list_permission_requests(db: Session = Depends(get_db)):
    return break_glass_service.list_permission_requests(db)


@router.post("/api/admin/permissions/{request_id}/decision")
def decide_permission(request_id: int, data: AdminPermissionDecision, user: User = Depends(require_role(UserRole.ADMIN)), db: Session = Depends(get_db)):
    request = break_glass_service.decide_permission_request(db, request_id, data.approve, user)
    return {"id": request.id, "status": request.status}