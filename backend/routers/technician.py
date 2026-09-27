"""Lab Technician router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.dependencies import require_technician
from database import get_db
from models.user import User
from schemas.user import UserRead

router = APIRouter(prefix="/api/technician", tags=["technician"])


@router.get("/profile", response_model=UserRead)
def get_profile(tech: User = Depends(require_technician), db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == tech.id).first()
