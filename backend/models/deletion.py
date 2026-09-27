"""DeletionRequest ORM model — Phase 3A."""
import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class DeletionRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    RESTORED = "RESTORED"
    PERMANENTLY_DELETED = "PERMANENTLY_DELETED"


class DeletionRequest(Base):
    """Non-admin deletion request awaiting admin review."""
    __tablename__ = "deletion_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    requested_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DeletionRequestStatus] = mapped_column(
        Enum(DeletionRequestStatus), nullable=False,
        default=DeletionRequestStatus.PENDING, index=True
    )
    reviewed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    record: Mapped["ReportRecord"] = relationship("ReportRecord")  # type: ignore
    requester: Mapped["User"] = relationship("User", foreign_keys=[requested_by])  # type: ignore
    reviewer: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by])  # type: ignore

    def __repr__(self) -> str:
        return f"<DeletionRequest id={self.id} record={self.record_id} status={self.status}>"
