"""Break-Glass ORM models."""
import enum
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class BreakGlassStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class BreakGlassRequest(Base):
    __tablename__ = "break_glass_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[BreakGlassStatus] = mapped_column(Enum(BreakGlassStatus), nullable=False, default=BreakGlassStatus.ACTIVE, index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    actions: Mapped[list["BreakGlassAction"]] = relationship("BreakGlassAction", back_populates="request", cascade="all, delete-orphan")


class BreakGlassAction(Base):
    __tablename__ = "break_glass_actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    request: Mapped["BreakGlassRequest"] = relationship("BreakGlassRequest", back_populates="actions")


class BreakGlassSuspensionEvent(Base):
    __tablename__ = "break_glass_suspension_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_count: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    patient_ids: Mapped[dict] = mapped_column(JSON, nullable=False)  # list stored as JSON
    suspended_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    restored_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    restored_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    restore_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
