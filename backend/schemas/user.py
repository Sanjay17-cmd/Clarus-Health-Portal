"""User-related Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, EmailStr
from models.user import UserRole, UserStatus


class SpecializationBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    status: UserStatus
    specialization_id: int | None = None
    specialization: SpecializationBrief | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None
    approved_by: int | None = None
    approved_at: datetime | None = None
    rejected_by: int | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None
    suspended_by: int | None = None
    suspended_at: datetime | None = None
    suspension_reason: str | None = None

    model_config = {"from_attributes": True}


class UserSummary(BaseModel):
    """Lightweight user representation for lists."""
    id: int
    name: str
    email: str
    role: UserRole
    status: UserStatus
    specialization: SpecializationBrief | None = None
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserSummary]
    total: int
    page: int
    page_size: int


class AdminActionRequest(BaseModel):
    reason: str | None = None


class AdminOverview(BaseModel):
    pending_approvals: int
    active_users: int
    doctors: int
    patients: int
    technicians: int
    suspended_users: int
    total_users: int
