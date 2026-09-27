"""Document Dispute ORM models."""
import enum
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class DisputeReason(str, enum.Enum):
    WRONG_PATIENT = "WRONG_PATIENT"
    NOT_MY_REPORT = "NOT_MY_REPORT"
    WRONG_DOCUMENT = "WRONG_DOCUMENT"
    DUPLICATE = "DUPLICATE"
    OTHER = "OTHER"


class DisputeStatus(str, enum.Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    QUARANTINED = "QUARANTINED"
    REASSIGNED = "REASSIGNED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class DocumentDispute(Base):
    __tablename__ = "document_disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_records.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="CASCADE"), nullable=False)
    reason: Mapped[DisputeReason] = mapped_column(Enum(DisputeReason), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DisputeStatus] = mapped_column(Enum(DisputeStatus), nullable=False, default=DisputeStatus.OPEN, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reassigned_to_patient_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reassigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    audit_entries: Mapped[list["DisputeAuditEntry"]] = relationship("DisputeAuditEntry", back_populates="dispute", cascade="all, delete-orphan")


class DisputeAuditEntry(Base):
    __tablename__ = "dispute_audit_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dispute_id: Mapped[int] = mapped_column(Integer, ForeignKey("document_disputes.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    dispute: Mapped["DocumentDispute"] = relationship("DocumentDispute", back_populates="audit_entries")
