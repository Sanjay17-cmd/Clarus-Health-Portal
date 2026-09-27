"""Specialization and SpecializationChangeRequest ORM models."""
import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ChangeRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Specialization(Base):
    __tablename__ = "specializations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    doctors: Mapped[list["User"]] = relationship(
        "User", back_populates="specialization", foreign_keys="User.specialization_id"
    )
    change_requests: Mapped[list["SpecializationChangeRequest"]] = relationship(
        "SpecializationChangeRequest",
        back_populates="requested_specialization",
        foreign_keys="SpecializationChangeRequest.requested_specialization_id",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Specialization id={self.id} name={self.name!r}>"


class SpecializationChangeRequest(Base):
    __tablename__ = "specialization_change_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False, index=True
    )
    current_specialization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("specializations.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True
    )
    requested_specialization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("specializations.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ChangeRequestStatus] = mapped_column(
        Enum(ChangeRequestStatus), nullable=False, default=ChangeRequestStatus.PENDING, index=True
    )
    reviewed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    doctor: Mapped["User"] = relationship(
        "User", back_populates="specialization_change_requests", foreign_keys=[doctor_id]
    )
    requested_specialization: Mapped["Specialization"] = relationship(
        "Specialization", back_populates="change_requests",
        foreign_keys=[requested_specialization_id]
    )
    current_specialization: Mapped["Specialization | None"] = relationship(
        "Specialization", foreign_keys=[current_specialization_id]
    )
