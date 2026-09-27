"""Document Dispute Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel
from models.dispute import DisputeReason, DisputeStatus


class DisputeCreate(BaseModel):
    record_id: int
    reason: DisputeReason
    explanation: str


class DisputeRead(BaseModel):
    id: int
    patient_id: int
    patient_name: str | None = None
    record_id: int
    group_id: int
    group_title: str | None = None
    record_type: str | None = None
    record_date: datetime | None = None
    reason: DisputeReason
    explanation: str
    status: DisputeStatus
    created_at: datetime
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    review_notes: str | None = None
    reassigned_to_patient_id: int | None = None
    reassigned_at: datetime | None = None

    model_config = {"from_attributes": True}


class DisputeActionRequest(BaseModel):
    action: str  # QUARANTINE | REASSIGN | RESOLVE | DISMISS | REVIEW
    notes: str | None = None
    reassign_patient_id: int | None = None  # required for REASSIGN


class DisputeAuditEntryRead(BaseModel):
    id: int
    actor_id: int | None = None
    actor_name: str | None = None
    action: str
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
