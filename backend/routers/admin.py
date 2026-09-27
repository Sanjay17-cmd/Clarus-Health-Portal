"""Admin router — user management, specializations, audit log."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.dependencies import require_admin
from database import get_db
from models.specialization import ChangeRequestStatus
from models.user import User, UserRole, UserStatus
from schemas.specialization import (
    SpecializationChangeRequestRead,
    SpecializationChangeRequestReview,
    SpecializationCreate,
    SpecializationRead,
    SpecializationUpdate,
)
from schemas.user import AdminActionRequest, AdminOverview, UserListResponse, UserRead
from schemas.audit import AuditLogListResponse, AuditLogRead
from services import specialization_service, user_service
from models.audit import AuditLog

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return user_service.get_overview(db)


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
def list_users(
    search: str | None = Query(None),
    role: UserRole | None = Query(None),
    status: UserStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    items, total = user_service.get_users(
        db, search=search, role=role, status=status, page=page, page_size=page_size
    )
    return UserListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return user_service.get_user_by_id(db, user_id)


@router.post("/users/{user_id}/approve", response_model=UserRead)
def approve_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return user_service.approve_user(db, user_id, admin)


@router.post("/users/{user_id}/reject", response_model=UserRead)
def reject_user(
    user_id: int, body: AdminActionRequest,
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    return user_service.reject_user(db, user_id, admin, reason=body.reason)


@router.post("/users/{user_id}/suspend", response_model=UserRead)
def suspend_user(
    user_id: int, body: AdminActionRequest,
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    return user_service.suspend_user(db, user_id, admin, reason=body.reason)


@router.post("/users/{user_id}/reactivate", response_model=UserRead)
def reactivate_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    return user_service.reactivate_user(db, user_id, admin)


# ── Specializations ───────────────────────────────────────────────────────────

@router.get("/specializations", response_model=list[SpecializationRead])
def list_all_specializations(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return specialization_service.list_specializations(db, active_only=False)


@router.post("/specializations", response_model=SpecializationRead, status_code=201)
def create_specialization(
    data: SpecializationCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    return specialization_service.create_specialization(db, data, admin)


@router.put("/specializations/{spec_id}", response_model=SpecializationRead)
def update_specialization(
    spec_id: int, data: SpecializationUpdate,
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    return specialization_service.update_specialization(db, spec_id, data, admin)


# ── Specialization Change Requests ────────────────────────────────────────────

@router.get("/specialization-requests", response_model=list[SpecializationChangeRequestRead])
def list_spec_requests(
    status: ChangeRequestStatus | None = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    reqs = specialization_service.list_change_requests(db, status=status)
    result = []
    for r in reqs:
        result.append(SpecializationChangeRequestRead(
            id=r.id,
            doctor_id=r.doctor_id,
            doctor_name=r.doctor.name if r.doctor else None,
            doctor_email=r.doctor.email if r.doctor else None,
            current_specialization_id=r.current_specialization_id,
            current_specialization_name=r.current_specialization.name if r.current_specialization else None,
            requested_specialization_id=r.requested_specialization_id,
            requested_specialization_name=r.requested_specialization.name if r.requested_specialization else None,
            reason=r.reason,
            status=r.status,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            review_notes=r.review_notes,
            created_at=r.created_at,
        ))
    return result


@router.post("/specialization-requests/{req_id}/approve", response_model=SpecializationChangeRequestRead)
def approve_spec_request(
    req_id: int, body: SpecializationChangeRequestReview,
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    r = specialization_service.approve_change_request(db, req_id, admin, notes=body.review_notes)
    return SpecializationChangeRequestRead(
        id=r.id, doctor_id=r.doctor_id,
        doctor_name=r.doctor.name if r.doctor else None,
        doctor_email=r.doctor.email if r.doctor else None,
        current_specialization_id=r.current_specialization_id,
        current_specialization_name=r.current_specialization.name if r.current_specialization else None,
        requested_specialization_id=r.requested_specialization_id,
        requested_specialization_name=r.requested_specialization.name if r.requested_specialization else None,
        reason=r.reason, status=r.status,
        reviewed_by=r.reviewed_by, reviewed_at=r.reviewed_at, review_notes=r.review_notes,
        created_at=r.created_at,
    )


@router.post("/specialization-requests/{req_id}/reject", response_model=SpecializationChangeRequestRead)
def reject_spec_request(
    req_id: int, body: SpecializationChangeRequestReview,
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    r = specialization_service.reject_change_request(db, req_id, admin, notes=body.review_notes)
    return SpecializationChangeRequestRead(
        id=r.id, doctor_id=r.doctor_id,
        doctor_name=r.doctor.name if r.doctor else None,
        doctor_email=r.doctor.email if r.doctor else None,
        current_specialization_id=r.current_specialization_id,
        current_specialization_name=r.current_specialization.name if r.current_specialization else None,
        requested_specialization_id=r.requested_specialization_id,
        requested_specialization_name=r.requested_specialization.name if r.requested_specialization else None,
        reason=r.reason, status=r.status,
        reviewed_by=r.reviewed_by, reviewed_at=r.reviewed_at, review_notes=r.review_notes,
        created_at=r.created_at,
    )


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    actor_id: int | None = Query(None),
    target_type: str | None = Query(None),
    target_id: int | None = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if target_type:
        q = q.filter(AuditLog.target_type == target_type)
    if target_id:
        q = q.filter(AuditLog.target_id == target_id)
    total = q.count()
    items = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return AuditLogListResponse(items=items, total=total)

