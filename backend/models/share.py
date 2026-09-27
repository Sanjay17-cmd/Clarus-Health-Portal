"""Share ORM models — ReportPermission (internal) and ReportShare (external)."""
import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class GranteeType(str, enum.Enum):
    USER = "USER"
    SPECIALIZATION = "SPECIALIZATION"


class ReportPermission(Base):
    """Internal sharing: patient grants a doctor or specialization access to a record."""
    __tablename__ = "report_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    granted_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    grantee_type: Mapped[GranteeType] = mapped_column(Enum(GranteeType), nullable=False)
    grantee_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True, index=True
    )
    grantee_spec_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("specializations.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True, index=True
    )
    can_view: Mapped[bool] = mapped_column(Integer, nullable=False, default=1)
    can_download: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    can_share: Mapped[bool] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    record: Mapped["ReportRecord"] = relationship(  # type: ignore[name-defined]
        "ReportRecord", back_populates="permissions"
    )
    granter: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[granted_by]
    )
    grantee_user: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[grantee_user_id]
    )
    grantee_spec: Mapped["Specialization | None"] = relationship(  # type: ignore[name-defined]
        "Specialization", foreign_keys=[grantee_spec_id]
    )

    def __repr__(self) -> str:
        return f"<ReportPermission id={self.id} record={self.record_id} type={self.grantee_type}>"


class ReportShare(Base):
    """External view-only share: a random token → a report record."""
    __tablename__ = "report_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("report_records.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Integer, nullable=False, default=1, index=True)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    record: Mapped["ReportRecord"] = relationship(  # type: ignore[name-defined]
        "ReportRecord", back_populates="shares"
    )
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )

    def __repr__(self) -> str:
        return f"<ReportShare id={self.id} token={self.token[:8]}…>"
