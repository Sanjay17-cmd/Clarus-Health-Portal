"""Notifications router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_active_user
from database import get_db
from models.user import User
from schemas.notification import NotificationListResponse, NotificationRead
from services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def get_my_notifications(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    items = notification_service.get_user_notifications(db, user.id)
    unread = sum(1 for n in items if not n.is_read)
    return NotificationListResponse(items=items, unread_count=unread)


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    from core.exceptions import not_found
    notif = notification_service.mark_read(db, notification_id, user.id)
    if not notif:
        raise not_found("Notification")
    db.commit()
    return notif


@router.post("/read-all")
def mark_all_read(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    count = notification_service.mark_all_read(db, user.id)
    db.commit()
    return {"marked_read": count}
