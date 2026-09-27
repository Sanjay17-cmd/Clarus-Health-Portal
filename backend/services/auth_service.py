"""Authentication service — registration and login logic."""
from sqlalchemy.orm import Session

from core.exceptions import bad_request, conflict, forbidden
from core.security import create_access_token, hash_password, verify_password
from models.specialization import Specialization
from models.user import User, UserRole, UserStatus
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from services import audit_service
from services import notification_service
from models.notification import NotificationType


def register_user(
    db: Session,
    data: RegisterRequest,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Create a new PENDING_APPROVAL user. Raises HTTPException on validation failure."""
    # Duplicate email check
    if db.query(User).filter(User.email == data.email).first():
        raise conflict("An account with this email address already exists")

    # Doctor specialization validation
    if data.role == UserRole.DOCTOR:
        spec = db.get(Specialization, data.specialization_id)
        if spec is None or not spec.is_active:
            raise bad_request("Selected specialization is not available")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        status=UserStatus.PENDING_APPROVAL,
        specialization_id=data.specialization_id if data.role == UserRole.DOCTOR else None,
    )
    db.add(user)
    db.flush()  # get user.id

    audit_service.create_log(
        db,
        action="USER_REGISTERED",
        actor=user,
        target_type="User",
        target_id=user.id,
        details={"role": data.role, "email": data.email},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()
    db.refresh(user)
    return user


def login_user(
    db: Session,
    data: LoginRequest,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> TokenResponse:
    """Authenticate user and return a JWT token. Raises HTTPException on failure."""
    user = db.query(User).filter(User.email == data.email).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise bad_request("Invalid email or password")

    if user.status == UserStatus.PENDING_APPROVAL:
        raise forbidden("Your account is pending approval by an administrator")
    if user.status == UserStatus.REJECTED:
        raise forbidden("Your account registration was rejected")
    if user.status == UserStatus.SUSPENDED:
        raise forbidden("Your account has been suspended")
    if user.status == UserStatus.DISABLED:
        raise forbidden("Your account has been disabled")

    # Record login and update last_login_at
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)

    audit_service.create_log(
        db,
        action="LOGIN_SUCCESS",
        actor=user,
        target_type="User",
        target_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
        status=user.status,
    )
