"""Emergency access requests and their immutable action history."""
import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class BreakGlassStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class BreakGlassRequest(Base):
    __tablename__ = "break_glass_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[BreakGlassStatus] = mapped_column(Enum(BreakGlassStatus), nullable=False, default=BreakGlassStatus.ACTIVE, index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)


class BreakGlassAction(Base):
    __tablename__ = "break_glass_actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class BreakGlassShare(Base):
    __tablename__ = "break_glass_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    shared_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    recipient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class AdminPermissionRequest(Base):
    __tablename__ = "admin_permission_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    requester_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False, index=True)
    break_glass_request_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=True, index=True)
    target_doctor_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING", index=True)
    decided_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)