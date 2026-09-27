"""Break-Glass Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, field_validator
from models.break_glass import BreakGlassStatus, BgRequestStatus


class BreakGlassRequestCreate(BaseModel):
    patient_id: int
    justification: str
    password: str

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


# ── Download Request Schemas ──────────────────────────────────────────────────

class BgDownloadRequestCreate(BaseModel):
    bg_request_id: int
    group_id: int
    record_ids: list[int]
    file_ids: list[int]
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if len(v.strip()) < 5:
            raise ValueError("Reason must be at least 5 characters")
        return v.strip()

    @field_validator("record_ids", "file_ids")
    @classmethod
    def not_empty_list(cls, v: list) -> list:
        if not v:
            raise ValueError("Must specify at least one record/file")
        return v


class BgDownloadRequestRead(BaseModel):
    id: int
    bg_request_id: int
    doctor_id: int
    doctor_name: str | None = None
    patient_id: int
    patient_name: str | None = None
    group_id: int
    group_title: str | None = None
    record_ids: list[int]
    file_ids: list[int]
    reason: str
    status: BgRequestStatus
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    download_performed: int = 0
    downloaded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BgDownloadReviewRequest(BaseModel):
    approved: bool
    review_notes: str | None = None


# ── Share Request Schemas ─────────────────────────────────────────────────────

class BgShareRequestCreate(BaseModel):
    bg_request_id: int
    recipient_doctor_id: int
    group_id: int
    record_ids: list[int] | None = None
    file_ids: list[int] | None = None
    can_download: bool = False
    reason: str | None = None


class BgShareRequestRead(BaseModel):
    id: int
    bg_request_id: int
    requesting_doctor_id: int
    requesting_doctor_name: str | None = None
    recipient_doctor_id: int
    recipient_doctor_name: str | None = None
    patient_id: int
    patient_name: str | None = None
    group_id: int
    group_title: str | None = None
    record_ids: list[int] | None = None
    file_ids: list[int] | None = None
    can_download: int = 0
    share_count: int
    reason: str | None = None
    status: BgRequestStatus
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    group_share_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BgShareReviewRequest(BaseModel):
    approved: bool
    review_notes: str | None = None
