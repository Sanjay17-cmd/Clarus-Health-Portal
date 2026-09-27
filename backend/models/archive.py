"""ZipExport and ZipImport ORM models — Phase 3A provenance."""
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class ZipExport(Base):
    """Provenance record for every ZIP archive downloaded."""
    __tablename__ = "zip_exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, comment="UUID v4")
    exported_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_groups.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    record_ids: Mapped[dict] = mapped_column(JSON, nullable=False)
    file_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    technician_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    exporter: Mapped["User"] = relationship("User", foreign_keys=[exported_by])  # type: ignore
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])  # type: ignore
    group: Mapped["ReportGroup"] = relationship("ReportGroup")  # type: ignore

    def __repr__(self) -> str:
        return f"<ZipExport id={self.id} by={self.exported_by}>"


class ZipImport(Base):
    """Provenance record for every ZIP archive imported."""
    __tablename__ = "zip_imports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, comment="UUID v4")
    original_export_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    imported_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    patient_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("report_groups.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    original_exporter_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    record_ids_imported: Mapped[dict] = mapped_column(JSON, nullable=False)
    file_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    import_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    importer: Mapped["User"] = relationship("User", foreign_keys=[imported_by])  # type: ignore
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id])  # type: ignore
    original_exporter: Mapped["User | None"] = relationship("User", foreign_keys=[original_exporter_id])  # type: ignore

    def __repr__(self) -> str:
        return f"<ZipImport id={self.id} by={self.imported_by}>"
