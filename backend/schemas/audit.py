"""Audit log schemas."""
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    actor_id: int | None = None
    actor_email: str | None = None
    action: str
    target_type: str | None = None
    target_id: int | None = None
    details: dict | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogRead]
    total: int
