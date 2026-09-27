"""Break-Glass Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, field_validator
from models.break_glass import BreakGlassStatus


class BreakGlassRequestCreate(BaseModel):
    patient_id: int
    justification: str
    password: str  # doctor re-enters own password for confirmation

    @field_validator("justification")
    @classmethod
    def justification_min_length(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Justification must be at least 10 characters")
        return v.strip()


class BreakGlassRequestRead(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str | None = None
    patient_id: int
    patient_name: str | None = None
    justification: str
    status: BreakGlassStatus
    granted_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    model_config = {"from_attributes": True}


class BreakGlassStatusResponse(BaseModel):
    is_active: bool
    request: BreakGlassRequestRead | None = None


class BreakGlassSuspensionEventRead(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str | None = None
    trigger_count: int
    window_start: datetime
    window_end: datetime
    patient_ids: list[int]
    suspended_at: datetime
    restored_by: int | None = None
    restored_at: datetime | None = None
    restore_notes: str | None = None

    model_config = {"from_attributes": True}


class RestoreFromSuspensionRequest(BaseModel):
    restore_notes: str | None = None
