"""Specialization-related Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel
from models.specialization import ChangeRequestStatus


class SpecializationCreate(BaseModel):
    name: str
    description: str | None = None


class SpecializationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class SpecializationRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SpecializationChangeRequestCreate(BaseModel):
    requested_specialization_id: int
    reason: str | None = None


class SpecializationChangeRequestRead(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str | None = None
    doctor_email: str | None = None
    current_specialization_id: int | None = None
    current_specialization_name: str | None = None
    requested_specialization_id: int
    requested_specialization_name: str | None = None
    reason: str | None = None
    status: ChangeRequestStatus
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SpecializationChangeRequestReview(BaseModel):
    review_notes: str | None = None
