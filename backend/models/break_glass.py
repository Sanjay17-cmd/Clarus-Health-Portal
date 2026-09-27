"""Break-Glass ORM models."""
import enum
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class BreakGlassStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class BgRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class BreakGlassRequest(Base):
    __tablename__ = "break_glass_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[BreakGlassStatus] = mapped_column(Enum(BreakGlassStatus), nullable=False, default=BreakGlassStatus.ACTIVE, index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    actions: Mapped[list["BreakGlassAction"]] = relationship("BreakGlassAction", back_populates="request", cascade="all, delete-orphan")
    download_requests: Mapped[list["BgDownloadRequest"]] = relationship("BgDownloadRequest", back_populates="bg_request", cascade="all, delete-orphan")
    share_requests: Mapped[list["BgShareRequest"]] = relationship("BgShareRequest", back_populates="bg_request", cascade="all, delete-orphan")


class BreakGlassAction(Base):
    __tablename__ = "break_glass_actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
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
    patient_ids: Mapped[dict] = mapped_column(JSON, nullable=False)
    suspended_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    restored_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    restored_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    restore_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class BgDownloadRequest(Base):
    """Admin-approval-required download request for a Break-Glass record."""
    __tablename__ = "bg_download_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bg_request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="RESTRICT"), nullable=False)
    record_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    file_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[BgRequestStatus] = mapped_column(Enum(BgRequestStatus), nullable=False, default=BgRequestStatus.PENDING, index=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_performed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    bg_request: Mapped["BreakGlassRequest"] = relationship("BreakGlassRequest", back_populates="download_requests")


class BgShareRequest(Base):
    """Pending admin-approval share when BG share count >= 4."""
    __tablename__ = "bg_share_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bg_request_id: Mapped[int] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    requesting_doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    recipient_doctor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="RESTRICT"), nullable=False)
    record_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    file_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    can_download: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    share_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=4)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[BgRequestStatus] = mapped_column(Enum(BgRequestStatus), nullable=False, default=BgRequestStatus.PENDING, index=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    group_share_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("group_shares.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    bg_request: Mapped["BreakGlassRequest"] = relationship("BreakGlassRequest", back_populates="share_requests")
