"""Auth router — register, login, me."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from database import get_db
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from schemas.user import UserRead
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    ua = request.headers.get("User-Agent")
    return ip, ua


@router.post("/register", response_model=UserRead, status_code=201)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _get_client_info(request)
    user = auth_service.register_user(db, data, ip_address=ip, user_agent=ua)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _get_client_info(request)
    return auth_service.login_user(db, data, ip_address=ip, user_agent=ua)


@router.get("/me", response_model=UserRead)
def me(current_user=Depends(get_current_user)):
    return current_user
