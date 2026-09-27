"""Record Access Event ORM model (patient-facing provenance timeline)."""
from datetime import datetime
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class RecordAccessEvent(Base):
    __tablename__ = "record_access_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(Integer, ForeignKey("report_records.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("report_groups.id", ondelete="CASCADE"), nullable=True)
    patient_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    break_glass_request_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("break_glass_requests.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)
