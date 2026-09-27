"""GroupShare ORM model — Phase 4: version/file-aware sharing with delegation."""
import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class GroupGranteeType(str, enum.Enum):
    USER = "USER"
    SPECIALIZATION = "SPECIALIZATION"


class ShareStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REVOKED = "REVOKED"


class GroupShare(Base):
    """Patient grants a doctor or specialization access to specific records/files of a group."""
    __tablename__ = "group_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_groups.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    granted_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    grantee_type: Mapped[GroupGranteeType] = mapped_column(Enum(GroupGranteeType), nullable=False)
    grantee_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True, index=True
    )
    grantee_spec_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("specializations.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True, index=True
    )
    max_versions: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0,
        comment="0 = all records; N > 0 = only the N most recent active records (ignored when group_share_records rows exist)"
    )
    can_view: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)
    can_download: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    can_share: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    can_delegate: Mapped[bool] = mapped_column(Integer, nullable=False, default=0,
        comment="1 = doctor may re-share to another doctor within original scope")
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1, index=True)

    # Status lifecycle
    status: Mapped[ShareStatus] = mapped_column(
        Enum(ShareStatus), nullable=False, default=ShareStatus.PENDING, index=True
    )
    parent_share_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("group_shares.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True, index=True,
        comment="Set if this is a delegated child share"
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    group: Mapped["ReportGroup"] = relationship("ReportGroup")  # type: ignore
    granter: Mapped["User"] = relationship("User", foreign_keys=[granted_by])  # type: ignore
    grantee_user: Mapped["User | None"] = relationship("User", foreign_keys=[grantee_user_id])  # type: ignore
    grantee_spec: Mapped["Specialization | None"] = relationship("Specialization", foreign_keys=[grantee_spec_id])  # type: ignore
    parent_share: Mapped["GroupShare | None"] = relationship("GroupShare", foreign_keys=[parent_share_id], remote_side="GroupShare.id")  # type: ignore

    # Version + file scope
    allowed_records: Mapped[list["GroupShareRecord"]] = relationship(  # type: ignore
        "GroupShareRecord", back_populates="share", cascade="all, delete-orphan"
    )
    allowed_files: Mapped[list["GroupShareFile"]] = relationship(  # type: ignore
        "GroupShareFile", back_populates="share", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<GroupShare id={self.id} group={self.group_id} status={self.status}>"


class GroupShareRecord(Base):
    """Specific record IDs allowed in a share (when patient selects specific versions)."""
    __tablename__ = "group_share_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("group_shares.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    share: Mapped[GroupShare] = relationship("GroupShare", back_populates="allowed_records")

    def __repr__(self) -> str:
        return f"<GroupShareRecord share={self.share_id} record={self.record_id}>"


class GroupShareFile(Base):
    """Specific file IDs allowed in a share (when patient selects specific files per version)."""
    __tablename__ = "group_share_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("group_shares.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_files.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    share: Mapped[GroupShare] = relationship("GroupShare", back_populates="allowed_files")

    def __repr__(self) -> str:
        return f"<GroupShareFile share={self.share_id} record={self.record_id} file={self.file_id}>"


class ShareExport(Base):
    """Audit trail of every ZIP export from a share."""
    __tablename__ = "share_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("group_shares.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    exported_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    export_token: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    record_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    file_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    share: Mapped[GroupShare] = relationship("GroupShare")
    exporter: Mapped["User"] = relationship("User", foreign_keys=[exported_by])  # type: ignore

    def __repr__(self) -> str:
        return f"<ShareExport id={self.id} share={self.share_id} by={self.exported_by}>"


class ShareImport(Base):
    """Tracks every ZIP import with provenance back to the original share/export."""
    __tablename__ = "share_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    export_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("share_exports.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True, index=True
    )
    share_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("group_shares.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True, index=True
    )
    imported_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    patient_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True, index=True
    )
    export_token: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    import_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    export: Mapped[ShareExport | None] = relationship("ShareExport")
    importer: Mapped["User"] = relationship("User", foreign_keys=[imported_by])  # type: ignore

    def __repr__(self) -> str:
        return f"<ShareImport id={self.id} by={self.imported_by}>"
