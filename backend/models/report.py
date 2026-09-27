"""Report ORM models — ReportGroup, ReportRecord, ReportFile."""
import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger, DateTime, Enum, ForeignKey, Integer,
    String, Text, BIGINT, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RecordType(str, enum.Enum):
    ORIGINAL = "ORIGINAL"
    HISTORICAL = "HISTORICAL"
    CORRECTION = "CORRECTION"


class SuspensionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PERMANENTLY_DELETED = "PERMANENTLY_DELETED"


class ReportGroup(Base):
    """A named category of reports for one patient (e.g. 'Blood Sugar')."""
    __tablename__ = "report_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    test_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1, index=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    patient: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[patient_id]
    )
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
    records: Mapped[list["ReportRecord"]] = relationship(
        "ReportRecord", back_populates="group", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ReportGroup id={self.id} title={self.title!r} patient={self.patient_id}>"


class ReportRecord(Base):
    """One dated entry within a report group."""
    __tablename__ = "report_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_groups.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    record_type: Mapped[RecordType] = mapped_column(
        Enum(RecordType), nullable=False, default=RecordType.ORIGINAL, index=True
    )
    corrects_record_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True, index=True
    )
    record_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lab_technician_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    lab_technician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)
    # Phase 3A — suspension / quarantine
    suspension_status: Mapped[SuspensionStatus] = mapped_column(
        Enum(SuspensionStatus), nullable=False, default=SuspensionStatus.ACTIVE, index=True
    )
    suspension_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    suspended_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    group: Mapped["ReportGroup"] = relationship("ReportGroup", back_populates="records")
    lab_technician: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[lab_technician_id]
    )
    corrected_record: Mapped["ReportRecord | None"] = relationship(
        "ReportRecord", remote_side="ReportRecord.id",
        foreign_keys=[corrects_record_id]
    )
    files: Mapped[list["ReportFile"]] = relationship(
        "ReportFile", back_populates="record",
        order_by="ReportFile.sort_order",
        cascade="all, delete-orphan"
    )
    permissions: Mapped[list["ReportPermission"]] = relationship(  # type: ignore[name-defined]
        "ReportPermission", back_populates="record", cascade="all, delete-orphan"
    )
    shares: Mapped[list["ReportShare"]] = relationship(  # type: ignore[name-defined]
        "ReportShare", back_populates="record", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ReportRecord id={self.id} type={self.record_type} group={self.group_id}>"


class ReportFile(Base):
    """A physical file attached to a report record."""
    __tablename__ = "report_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_size: Mapped[int] = mapped_column(BIGINT, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    record: Mapped["ReportRecord"] = relationship("ReportRecord", back_populates="files")
    uploader: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[uploaded_by]
    )

    def __repr__(self) -> str:
        return f"<ReportFile id={self.id} name={self.original_name!r}>"
