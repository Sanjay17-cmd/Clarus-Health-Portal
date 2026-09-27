"""Notification service — create and query notifications."""
from sqlalchemy.orm import Session

from models.notification import Notification, NotificationType
from models.user import User


def create_notification(
    db: Session,
    *,
    recipient_id: int,
    title: str,
    message: str,
    type: NotificationType = NotificationType.GENERAL,
) -> Notification:
    notif = Notification(
        recipient_id=recipient_id,
        title=title,
        message=message,
        type=type,
    )
    db.add(notif)
    db.flush()
    return notif


def get_user_notifications(db: Session, user_id: int) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.recipient_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


def mark_read(db: Session, notification_id: int, user_id: int) -> Notification | None:
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.recipient_id == user_id)
        .first()
    )
    if notif:
        notif.is_read = True
        db.flush()
    return notif


def mark_all_read(db: Session, user_id: int) -> int:
    count = (
        db.query(Notification)
        .filter(Notification.recipient_id == user_id, Notification.is_read == False)
        .update({"is_read": True})
    )
    return count
