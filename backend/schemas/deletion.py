"""Deletion request Pydantic schemas — Phase 3A."""
from datetime import datetime
from pydantic import BaseModel, field_validator
from models.deletion import DeletionRequestStatus


class DeletionRequestCreate(BaseModel):
    record_id: int
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Reason must be at least 5 characters")
        return v


class DeletionRequestRead(BaseModel):
    id: int
    record_id: int
    requested_by: int
    requester_name: str = ""
    reason: str
    status: DeletionRequestStatus
    reviewed_by: int | None
    reviewer_name: str | None = None
    reviewed_at: datetime | None
    review_notes: str | None
    # Enriched record info
    group_title: str = ""
    patient_name: str = ""
    record_type: str = ""
    record_date: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeletionReviewRequest(BaseModel):
    decision: str  # "RESTORE" or "PERMANENTLY_DELETE"
    review_notes: str | None = None
