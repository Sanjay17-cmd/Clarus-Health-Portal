"""Notification schemas."""
from datetime import datetime
from pydantic import BaseModel
from models.notification import NotificationType


class NotificationRead(BaseModel):
    id: int
    recipient_id: int
    title: str
    message: str
    type: NotificationType
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationRead]
    unread_count: int
