"""Specialization service — CRUD and change request handling."""
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload

from core.exceptions import bad_request, conflict, not_found
from models.notification import NotificationType
from models.specialization import ChangeRequestStatus, Specialization, SpecializationChangeRequest
from models.user import User, UserRole
from schemas.specialization import (
    SpecializationChangeRequestCreate,
    SpecializationCreate,
    SpecializationUpdate,
)
from services import audit_service, notification_service


# ── Specialization CRUD ───────────────────────────────────────────────────────

def list_specializations(db: Session, active_only: bool = False) -> list[Specialization]:
    q = db.query(Specialization)
    if active_only:
        q = q.filter(Specialization.is_active == True)
    return q.order_by(Specialization.name).all()


def get_specialization(db: Session, spec_id: int) -> Specialization:
    spec = db.get(Specialization, spec_id)
    if not spec:
        raise not_found("Specialization")
    return spec


def create_specialization(
    db: Session, data: SpecializationCreate, admin: User
) -> Specialization:
    if db.query(Specialization).filter(Specialization.name == data.name).first():
        raise conflict("A specialization with this name already exists")
    spec = Specialization(name=data.name, description=data.description)
    db.add(spec)
    db.flush()
    audit_service.create_log(
        db, action="SPECIALIZATION_CREATED", actor=admin,
        target_type="Specialization", target_id=spec.id,
        details={"name": data.name},
    )
    db.commit()
    db.refresh(spec)
    return spec


def update_specialization(
    db: Session, spec_id: int, data: SpecializationUpdate, admin: User
) -> Specialization:
    spec = get_specialization(db, spec_id)
    if data.name is not None:
        existing = db.query(Specialization).filter(
            Specialization.name == data.name, Specialization.id != spec_id
        ).first()
        if existing:
            raise conflict("A specialization with this name already exists")
        spec.name = data.name
    if data.description is not None:
        spec.description = data.description
    if data.is_active is not None:
        spec.is_active = data.is_active

    audit_service.create_log(
        db, action="SPECIALIZATION_UPDATED", actor=admin,
        target_type="Specialization", target_id=spec.id,
        details={"changes": data.model_dump(exclude_none=True)},
    )
    db.commit()
    db.refresh(spec)
    return spec


# ── Specialization Change Requests ────────────────────────────────────────────

def create_change_request(
    db: Session, doctor: User, data: SpecializationChangeRequestCreate
) -> SpecializationChangeRequest:
    if doctor.role != UserRole.DOCTOR:
        raise bad_request("Only doctors can submit specialization change requests")

    # Block if a PENDING request already exists
    pending = (
        db.query(SpecializationChangeRequest)
        .filter(
            SpecializationChangeRequest.doctor_id == doctor.id,
            SpecializationChangeRequest.status == ChangeRequestStatus.PENDING,
        )
        .first()
    )
    if pending:
        raise conflict("You already have a pending specialization change request")

    target_spec = db.get(Specialization, data.requested_specialization_id)
    if target_spec is None or not target_spec.is_active:
        raise bad_request("Requested specialization is not available")

    req = SpecializationChangeRequest(
        doctor_id=doctor.id,
        current_specialization_id=doctor.specialization_id,
        requested_specialization_id=data.requested_specialization_id,
        reason=data.reason,
    )
    db.add(req)
    db.flush()

    notification_service.create_notification(
        db,
        recipient_id=doctor.id,
        title="Specialization Change Requested",
        message=f"Your request to change specialization to '{target_spec.name}' has been submitted and is awaiting admin review.",
        type=NotificationType.SPEC_CHANGE_REQUESTED,
    )
    audit_service.create_log(
        db, action="SPEC_CHANGE_REQUESTED", actor=doctor,
        target_type="SpecializationChangeRequest", target_id=req.id,
        details={
            "current_specialization_id": doctor.specialization_id,
            "requested_specialization_id": data.requested_specialization_id,
        },
    )
    db.commit()
    db.refresh(req)
    return req


def list_change_requests(
    db: Session, status: ChangeRequestStatus | None = None
) -> list[SpecializationChangeRequest]:
    q = db.query(SpecializationChangeRequest).options(
        joinedload(SpecializationChangeRequest.doctor),
        joinedload(SpecializationChangeRequest.requested_specialization),
        joinedload(SpecializationChangeRequest.current_specialization),
    )
    if status:
        q = q.filter(SpecializationChangeRequest.status == status)
    return q.order_by(SpecializationChangeRequest.created_at.desc()).all()


def approve_change_request(
    db: Session, request_id: int, admin: User, notes: str | None = None
) -> SpecializationChangeRequest:
    req = _get_pending_request(db, request_id)
    req.status = ChangeRequestStatus.APPROVED
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = notes

    # Apply the specialization change to the doctor
    doctor = req.doctor
    doctor.specialization_id = req.requested_specialization_id

    notification_service.create_notification(
        db,
        recipient_id=doctor.id,
        title="Specialization Change Approved",
        message=f"Your specialization has been updated to '{req.requested_specialization.name}'.",
        type=NotificationType.SPEC_CHANGE_APPROVED,
    )
    audit_service.create_log(
        db, action="SPEC_CHANGE_APPROVED", actor=admin,
        target_type="SpecializationChangeRequest", target_id=req.id,
        details={"doctor_id": doctor.id, "new_specialization_id": req.requested_specialization_id, "notes": notes},
    )
    db.commit()
    db.refresh(req)
    return req


def reject_change_request(
    db: Session, request_id: int, admin: User, notes: str | None = None
) -> SpecializationChangeRequest:
    req = _get_pending_request(db, request_id)
    req.status = ChangeRequestStatus.REJECTED
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_notes = notes

    notification_service.create_notification(
        db,
        recipient_id=req.doctor_id,
        title="Specialization Change Rejected",
        message=f"Your request to change specialization has been rejected.{(' Notes: ' + notes) if notes else ''}",
        type=NotificationType.SPEC_CHANGE_REJECTED,
    )
    audit_service.create_log(
        db, action="SPEC_CHANGE_REJECTED", actor=admin,
        target_type="SpecializationChangeRequest", target_id=req.id,
        details={"doctor_id": req.doctor_id, "notes": notes},
    )
    db.commit()
    db.refresh(req)
    return req


def _get_pending_request(db: Session, request_id: int) -> SpecializationChangeRequest:
    req = db.query(SpecializationChangeRequest).options(
        joinedload(SpecializationChangeRequest.doctor),
        joinedload(SpecializationChangeRequest.requested_specialization),
    ).filter(SpecializationChangeRequest.id == request_id).first()
    if not req:
        raise not_found("Specialization change request")
    if req.status != ChangeRequestStatus.PENDING:
        raise bad_request(f"Request has already been {req.status.lower()}")
    return req
