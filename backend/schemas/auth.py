"""Auth-related Pydantic schemas."""
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from models.user import UserRole


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    specialization_id: int | None = None  # Required for DOCTOR

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def no_admin_registration(cls, v: UserRole) -> UserRole:
        if v == UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be registered via this endpoint")
        return v

    @model_validator(mode="after")
    def doctor_needs_specialization(self) -> "RegisterRequest":
        if self.role == UserRole.DOCTOR and self.specialization_id is None:
            raise ValueError("Doctors must select a specialization")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    status: str
