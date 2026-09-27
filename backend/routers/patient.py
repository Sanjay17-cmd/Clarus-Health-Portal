"""Patient router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.dependencies import require_patient, get_active_user
from database import get_db
from models.user import User, UserRole, UserStatus
from schemas.user import UserRead

router = APIRouter(prefix="/api/patient", tags=["patient"])


@router.get("/profile", response_model=UserRead)
def get_profile(patient: User = Depends(require_patient), db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == patient.id).first()


@router.get("/doctors")
def list_doctors_for_share(
    search: str | None = Query(None),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Patients can list active doctors for share selection."""
    q = db.query(User).filter(User.role == UserRole.DOCTOR, User.status == UserStatus.ACTIVE)
    if search:
        q = q.filter(User.name.ilike(f"%{search}%"))
    doctors = q.order_by(User.name).limit(50).all()
    return [{"id": d.id, "name": d.name, "email": d.email} for d in doctors]
