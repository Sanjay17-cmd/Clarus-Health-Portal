"""Document Disputes router."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from core.dependencies import get_active_user, require_role
from database import get_db
from models.user import User, UserRole
from schemas.dispute import DisputeCreate, DisputeRead, DisputeActionRequest, DisputeAuditEntryRead
from services import dispute_service

router = APIRouter(tags=["disputes"])


def _ip(request: Request) -> str | None:
    return request.headers.get("X-Forwarded-For", request.client.host if request.client else None)


def _enrich(d, db: Session) -> DisputeRead:
    from models.user import User as U
    from models.report import ReportGroup, ReportRecord
    patient = db.query(U).filter(U.id == d.patient_id).first()
    group = db.query(ReportGroup).filter(ReportGroup.id == d.group_id).first()
    record = db.query(ReportRecord).filter(ReportRecord.id == d.record_id).first()
    return DisputeRead(
        id=d.id, patient_id=d.patient_id,
        patient_name=patient.name if patient else None,
        record_id=d.record_id, group_id=d.group_id,
        group_title=group.title if group else None,
        record_type=record.record_type.value if record and record.record_type else None,
        record_date=record.record_date if record else None,
        reason=d.reason, explanation=d.explanation, status=d.status,
        created_at=d.created_at, reviewed_by=d.reviewed_by,
        reviewed_at=d.reviewed_at, review_notes=d.review_notes,
        reassigned_to_patient_id=d.reassigned_to_patient_id,
        reassigned_at=d.reassigned_at,
    )


# ── Patient ────────────────────────────────────────────────────────────────────

@router.post("/api/disputes", response_model=DisputeRead, status_code=201)
def create_dispute(
    data: DisputeCreate,
    request: Request,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db)
):
    if user.role != UserRole.PATIENT:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only patients can dispute documents.")
    d = dispute_service.create_dispute(db, data, user, ip=_ip(request))
    return _enrich(d, db)


@router.get("/api/disputes/my", response_model=list[DisputeRead])
def my_disputes(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return [_enrich(d, db) for d in dispute_service.get_patient_disputes(db, user.id)]


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/api/admin/disputes", response_model=list[DisputeRead])
def admin_list_disputes(
    status: str | None = None,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    return [_enrich(d, db) for d in dispute_service.list_disputes(db, status)]


@router.post("/api/admin/disputes/{dispute_id}/action", response_model=DisputeRead)
def admin_act(
    dispute_id: int,
    data: DisputeActionRequest,
    request: Request,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    d = dispute_service.admin_act_on_dispute(db, dispute_id, data, user, ip=_ip(request))
    return _enrich(d, db)


@router.get("/api/admin/disputes/{dispute_id}/audit", response_model=list[DisputeAuditEntryRead])
def admin_dispute_audit(
    dispute_id: int,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    from models.dispute import DisputeAuditEntry
    from models.user import User as U
    entries = db.query(DisputeAuditEntry).filter(DisputeAuditEntry.dispute_id == dispute_id).order_by(DisputeAuditEntry.created_at.asc()).all()
    result = []
    for e in entries:
        actor = db.query(U).filter(U.id == e.actor_id).first() if e.actor_id else None
        result.append(DisputeAuditEntryRead(
            id=e.id, actor_id=e.actor_id,
            actor_name=actor.name if actor else None,
            action=e.action, notes=e.notes, created_at=e.created_at,
        ))
    return result
