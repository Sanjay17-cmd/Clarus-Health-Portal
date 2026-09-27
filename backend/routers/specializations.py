"""Public specializations router — returns active specializations for the registration form."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.specialization import SpecializationRead
from services import specialization_service

router = APIRouter(prefix="/api/specializations", tags=["specializations"])


@router.get("", response_model=list[SpecializationRead])
def list_active_specializations(db: Session = Depends(get_db)):
    """Public endpoint — no authentication required. Returns only active specializations."""
    return specialization_service.list_specializations(db, active_only=True)
