"""Patient activity / provenance feed schemas."""
from datetime import datetime
from pydantic import BaseModel


class AccessEventRead(BaseModel):
    id: int
    record_id: int
    group_id: int | None = None
    group_title: str | None = None
    patient_id: int
    actor_id: int | None = None
    actor_name: str | None = None
    actor_role: str | None = None
    event_type: str
    details: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
