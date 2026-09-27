"""User management service for admin operations."""
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from core.exceptions import bad_request, not_found
from models.notification import NotificationType
from models.user import User, UserRole, UserStatus
from schemas.user import AdminOverview
from services import audit_service, notification_service


def get_users(
    db: Session,
    *,
    search: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[User], int]:
    query = db.query(User).options(joinedload(User.specialization))
    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.name.ilike(like)) | (User.email.ilike(like))
        )
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)

    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).options(joinedload(User.specialization)).filter(User.id == user_id).first()
    if not user:
        raise not_found("User")
    return user


def approve_user(db: Session, user_id: int, admin: User) -> User:
    user = get_user_by_id(db, user_id)
    if user.status != UserStatus.PENDING_APPROVAL:
        raise bad_request(f"User is not pending approval (current status: {user.status})")

    user.status = UserStatus.ACTIVE
    user.approved_by = admin.id
    user.approved_at = datetime.now(timezone.utc)

    notification_service.create_notification(
        db,
        recipient_id=user.id,
        title="Account Approved",
        message="Your account has been approved. You can now log in to the portal.",
        type=NotificationType.ACCOUNT_APPROVED,
    )
    audit_service.create_log(
        db,
        action="USER_APPROVED",
        actor=admin,
        target_type="User",
        target_id=user.id,
        details={"approved_user_email": user.email, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return user


def reject_user(db: Session, user_id: int, admin: User, reason: str | None = None) -> User:
    user = get_user_by_id(db, user_id)
    if user.status != UserStatus.PENDING_APPROVAL:
        raise bad_request(f"User is not pending approval (current status: {user.status})")

    user.status = UserStatus.REJECTED
    user.rejected_by = admin.id
    user.rejected_at = datetime.now(timezone.utc)
    user.rejection_reason = reason

    notification_service.create_notification(
        db,
        recipient_id=user.id,
        title="Account Rejected",
        message=f"Your account registration has been rejected.{(' Reason: ' + reason) if reason else ''}",
        type=NotificationType.ACCOUNT_REJECTED,
    )
    audit_service.create_log(
        db,
        action="USER_REJECTED",
        actor=admin,
        target_type="User",
        target_id=user.id,
        details={"rejected_user_email": user.email, "reason": reason},
    )
    db.commit()
    db.refresh(user)
    return user


def suspend_user(db: Session, user_id: int, admin: User, reason: str | None = None) -> User:
    user = get_user_by_id(db, user_id)
    if user.role == UserRole.ADMIN:
        raise bad_request("Cannot suspend an Admin account")
    if user.status == UserStatus.SUSPENDED:
        raise bad_request("User is already suspended")

    user.status = UserStatus.SUSPENDED
    user.suspended_by = admin.id
    user.suspended_at = datetime.now(timezone.utc)
    user.suspension_reason = reason

    notification_service.create_notification(
        db,
        recipient_id=user.id,
        title="Account Suspended",
        message=f"Your account has been suspended.{(' Reason: ' + reason) if reason else ''} Contact support for assistance.",
        type=NotificationType.ACCOUNT_SUSPENDED,
    )
    audit_service.create_log(
        db,
        action="USER_SUSPENDED",
        actor=admin,
        target_type="User",
        target_id=user.id,
        details={"suspended_user_email": user.email, "reason": reason},
    )
    db.commit()
    db.refresh(user)
    return user


def reactivate_user(db: Session, user_id: int, admin: User) -> User:
    user = get_user_by_id(db, user_id)
    if user.status != UserStatus.SUSPENDED:
        raise bad_request("User is not currently suspended")

    user.status = UserStatus.ACTIVE
    user.suspended_by = None
    user.suspended_at = None
    user.suspension_reason = None

    notification_service.create_notification(
        db,
        recipient_id=user.id,
        title="Account Reactivated",
        message="Your account has been reactivated. You can now log in to the portal.",
        type=NotificationType.ACCOUNT_REACTIVATED,
    )
    audit_service.create_log(
        db,
        action="USER_REACTIVATED",
        actor=admin,
        target_type="User",
        target_id=user.id,
        details={"reactivated_user_email": user.email},
    )
    db.commit()
    db.refresh(user)
    return user


def get_overview(db: Session) -> AdminOverview:
    counts: dict[str, int] = {}

    total = db.query(func.count(User.id)).scalar() or 0
    pending = db.query(func.count(User.id)).filter(User.status == UserStatus.PENDING_APPROVAL).scalar() or 0
    active = db.query(func.count(User.id)).filter(User.status == UserStatus.ACTIVE).scalar() or 0
    suspended = db.query(func.count(User.id)).filter(User.status == UserStatus.SUSPENDED).scalar() or 0
    doctors = db.query(func.count(User.id)).filter(User.role == UserRole.DOCTOR).scalar() or 0
    patients = db.query(func.count(User.id)).filter(User.role == UserRole.PATIENT).scalar() or 0
    techs = db.query(func.count(User.id)).filter(User.role == UserRole.LAB_TECHNICIAN).scalar() or 0

    return AdminOverview(
        pending_approvals=pending,
        active_users=active,
        doctors=doctors,
        patients=patients,
        technicians=techs,
        suspended_users=suspended,
        total_users=total,
    )
