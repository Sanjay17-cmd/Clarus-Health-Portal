"""Doctor router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from core.dependencies import require_doctor
from database import get_db
from models.user import User
from schemas.specialization import SpecializationChangeRequestCreate, SpecializationChangeRequestRead
from schemas.user import UserRead
from services import specialization_service

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


@router.get("/profile", response_model=UserRead)
def get_profile(doctor: User = Depends(require_doctor), db: Session = Depends(get_db)):
    # Reload with specialization joined
    from sqlalchemy.orm import joinedload
    user = db.query(User).options(joinedload(User.specialization)).filter(User.id == doctor.id).first()
    return user


@router.post("/specialization-request", response_model=SpecializationChangeRequestRead, status_code=201)
def request_specialization_change(
    data: SpecializationChangeRequestCreate,
    doctor: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    r = specialization_service.create_change_request(db, doctor, data)
    return SpecializationChangeRequestRead(
        id=r.id,
        doctor_id=r.doctor_id,
        doctor_name=doctor.name,
        doctor_email=doctor.email,
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
    )


@router.get("/specialization-requests", response_model=list[SpecializationChangeRequestRead])
def my_specialization_requests(
    doctor: User = Depends(require_doctor),
    db: Session = Depends(get_db),
):
    from models.specialization import SpecializationChangeRequest
    reqs = (
        db.query(SpecializationChangeRequest)
        .options(
            joinedload(SpecializationChangeRequest.requested_specialization),
            joinedload(SpecializationChangeRequest.current_specialization),
        )
        .filter(SpecializationChangeRequest.doctor_id == doctor.id)
        .order_by(SpecializationChangeRequest.created_at.desc())
        .all()
    )
    return [
        SpecializationChangeRequestRead(
            id=r.id,
            doctor_id=r.doctor_id,
            doctor_name=doctor.name,
            doctor_email=doctor.email,
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
        )
        for r in reqs
    ]
