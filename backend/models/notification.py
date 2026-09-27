"""Notification ORM model."""
import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class NotificationType(str, enum.Enum):
    ACCOUNT_APPROVED = "ACCOUNT_APPROVED"
    ACCOUNT_REJECTED = "ACCOUNT_REJECTED"
    ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED"
    ACCOUNT_REACTIVATED = "ACCOUNT_REACTIVATED"
    SPEC_CHANGE_REQUESTED = "SPEC_CHANGE_REQUESTED"
    SPEC_CHANGE_APPROVED = "SPEC_CHANGE_APPROVED"
    SPEC_CHANGE_REJECTED = "SPEC_CHANGE_REJECTED"
    # Phase 2 — Report sharing
    REPORT_SHARED = "REPORT_SHARED"
    SHARE_PERMISSION_CHANGED = "SHARE_PERMISSION_CHANGED"
    SHARE_REVOKED = "SHARE_REVOKED"
    EXTERNAL_SHARE_CREATED = "EXTERNAL_SHARE_CREATED"
    SYSTEM = "SYSTEM"
    GENERAL = "GENERAL"
    # Phase 3A
    CORRECTION_CREATED = "CORRECTION_CREATED"
    RECORD_SUSPENDED = "RECORD_SUSPENDED"
    RECORD_RESTORED = "RECORD_RESTORED"
    RECORD_PERMANENTLY_DELETED = "RECORD_PERMANENTLY_DELETED"
    TECHNICIAN_VIEWED = "TECHNICIAN_VIEWED"
    DOCTOR_DOWNLOADED = "DOCTOR_DOWNLOADED"
    ZIP_EXPORTED = "ZIP_EXPORTED"
    ZIP_IMPORTED = "ZIP_IMPORTED"
    # Phase 3B
    BREAK_GLASS_REQUEST = "BREAK_GLASS_REQUEST"
    BREAK_GLASS_SUSPENSION = "BREAK_GLASS_SUSPENSION"
    BREAK_GLASS_RESTORED = "BREAK_GLASS_RESTORED"
    DOCUMENT_DISPUTE_CREATED = "DOCUMENT_DISPUTE_CREATED"
    DOCUMENT_DISPUTE_UPDATED = "DOCUMENT_DISPUTE_UPDATED"
    DOCUMENT_DISPUTE_RESOLVED = "DOCUMENT_DISPUTE_RESOLVED"
    DOCTOR_VIEWED = "DOCTOR_VIEWED"
    EMERGENCY_SHARE_CREATED = "EMERGENCY_SHARE_CREATED"
    RECORD_QUARANTINED = "RECORD_QUARANTINED"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
    RECORD_ACCESS_ALERT = "RECORD_ACCESS_ALERT"
    DISPUTE_QUARANTINED = "DISPUTE_QUARANTINED"
    DISPUTE_REASSIGNED = "DISPUTE_REASSIGNED"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), nullable=False, default=NotificationType.GENERAL
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    recipient: Mapped["User"] = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Notification id={self.id} recipient={self.recipient_id} type={self.type}>"
