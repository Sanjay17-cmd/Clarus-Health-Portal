"""Patient activity (provenance timeline) router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.dependencies import get_active_user
from database import get_db
from models.user import User, UserRole
from services import patient_activity_service

router = APIRouter(tags=["patient-activity"])


@router.get("/api/patient/activity")
def get_my_activity(
    limit: int = 100,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db)
):
    if user.role != UserRole.PATIENT:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only patients can view their own activity.")
    return patient_activity_service.get_patient_activity(db, user.id, limit=limit)
