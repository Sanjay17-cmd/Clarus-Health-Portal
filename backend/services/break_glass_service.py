"""Time-limited emergency access, read-only delegation, and admin approvals."""
from datetime import datetime, timedelta

import bcrypt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.exceptions import bad_request, forbidden, not_found
from models.break_glass import AdminPermissionRequest, BreakGlassAction, BreakGlassRequest, BreakGlassShare, BreakGlassStatus
from models.notification import NotificationType
from models.report import ReportGroup
from models.user import User, UserRole, UserStatus
from services import audit_service, notification_service

BREAK_GLASS_DURATION = timedelta(hours=4)


def _now() -> datetime:
    return datetime.utcnow()


def get_active_break_glass(db: Session, doctor_id: int, patient_id: int) -> BreakGlassRequest | None:
    return db.query(BreakGlassRequest).filter(
        BreakGlassRequest.doctor_id == doctor_id,
        BreakGlassRequest.patient_id == patient_id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
        BreakGlassRequest.expires_at > _now(),
    ).order_by(BreakGlassRequest.granted_at.desc()).first()


def get_active_access(db: Session, doctor_id: int, patient_id: int, group_id: int | None = None) -> BreakGlassRequest | None:
    request = get_active_break_glass(db, doctor_id, patient_id)
    if request:
        return request
    query = db.query(BreakGlassShare).join(BreakGlassRequest).filter(
        BreakGlassShare.recipient_id == doctor_id,
        BreakGlassRequest.patient_id == patient_id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
        BreakGlassRequest.expires_at > _now(),
    )
    if group_id is not None:
        query = query.filter(BreakGlassShare.group_id == group_id)
    share = query.order_by(BreakGlassShare.created_at.desc()).first()
    return share and db.query(BreakGlassRequest).filter(BreakGlassRequest.id == share.request_id).first()


def request_break_glass(db: Session, data, doctor: User) -> BreakGlassRequest:
    if doctor.role != UserRole.DOCTOR or doctor.status != UserStatus.ACTIVE:
        raise forbidden("Only active doctors can request emergency access")
    if not bcrypt.checkpw(data.password.encode(), doctor.password_hash.encode()):
        audit_service.create_log(db, action="BREAK_GLASS_PASSWORD_FAILED", actor=doctor, target_type="User", target_id=doctor.id)
        db.commit()
        raise HTTPException(status_code=401, detail="Password incorrect. Emergency access denied.")
    patient = db.query(User).filter(User.id == data.patient_id, User.role == UserRole.PATIENT, User.status == UserStatus.ACTIVE).first()
    if not patient:
        raise not_found("Patient")

    req = BreakGlassRequest(
        doctor_id=doctor.id,
        patient_id=patient.id,
        justification=data.justification,
        status=BreakGlassStatus.ACTIVE,
        expires_at=_now() + BREAK_GLASS_DURATION,
    )
    db.add(req)
    db.flush()
    db.add(BreakGlassAction(request_id=req.id, action="ACCESS_GRANTED", details={"justification": data.justification}))
    notification_service.create_notification(
        db, recipient_id=patient.id,
        title="Emergency Access to Your Records",
        message=f"Dr. {doctor.name} accessed your records using emergency access. Reason: {data.justification}",
        type=NotificationType.BREAK_GLASS_REQUEST,
    )
    audit_service.create_log(db, action="BREAK_GLASS_REQUESTED", actor=doctor, target_type="BreakGlassRequest", target_id=req.id,
                             details={"patient_id": patient.id, "expires_at": req.expires_at.isoformat(), "justification": data.justification})
    db.commit()
    db.refresh(req)
    return req


def search_patients(db: Session, search: str | None) -> list[User]:
    query = db.query(User).filter(User.role == UserRole.PATIENT, User.status == UserStatus.ACTIVE)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter((User.name.ilike(like)) | (User.email.ilike(like)))
    return query.order_by(User.name).limit(50).all()


def list_doctors(db: Session) -> list[User]:
    return db.query(User).filter(User.role == UserRole.DOCTOR, User.status == UserStatus.ACTIVE).order_by(User.name).limit(250).all()


def request_download_permission(db: Session, group_id: int, justification: str, doctor: User) -> AdminPermissionRequest:
    group = db.query(ReportGroup).filter(ReportGroup.id == group_id, ReportGroup.is_active == 1).first()
    if not group:
        raise not_found("Report Group")
    from services.report_service import _assert_doctor_access
    try:
        _assert_doctor_access(db, group_id, doctor)
    except Exception:
        if not get_active_access(db, doctor.id, group.patient_id, group_id):
            raise
    return _create_permission_request(db, doctor, group, "DOWNLOAD", justification)


def _create_permission_request(db: Session, doctor: User, group: ReportGroup, action: str, justification: str,
                               doctor_ids: list[int] | None = None, break_glass_request_id: int | None = None) -> AdminPermissionRequest:
    pending = AdminPermissionRequest(
        action=action, requester_id=doctor.id, patient_id=group.patient_id, group_id=group.id,
        target_doctor_ids=doctor_ids, justification=justification,
        break_glass_request_id=break_glass_request_id, status="PENDING",
    )
    db.add(pending)
    db.flush()
    admins = db.query(User).filter(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE).all()
    for admin in admins:
        notification_service.create_notification(db, recipient_id=admin.id, title="Admin Permission Requested",
            message=f"Dr. {doctor.name} requested {action.lower().replace('_', ' ')} permission for '{group.title}'.",
            type=NotificationType.GENERAL)
    audit_service.create_log(db, action="ADMIN_PERMISSION_REQUESTED", actor=doctor,
        target_type="AdminPermissionRequest", target_id=pending.id,
        details={"action": action, "group_id": group.id, "patient_id": group.patient_id, "doctor_ids": doctor_ids})
    db.commit()
    db.refresh(pending)
    return pending


def consume_download_permission(db: Session, doctor: User, group_id: int) -> bool:
    permission = db.query(AdminPermissionRequest).filter(
        AdminPermissionRequest.requester_id == doctor.id,
        AdminPermissionRequest.group_id == group_id,
        AdminPermissionRequest.action == "DOWNLOAD",
        AdminPermissionRequest.status == "APPROVED",
        AdminPermissionRequest.consumed_at.is_(None),
    ).order_by(AdminPermissionRequest.decided_at.desc()).with_for_update().first()
    if not permission:
        return False
    permission.consumed_at = _now()
    return True


def share_during_emergency(db: Session, data, doctor: User) -> dict:
    req = db.query(BreakGlassRequest).filter(
        BreakGlassRequest.id == data.request_id, BreakGlassRequest.doctor_id == doctor.id,
        BreakGlassRequest.status == BreakGlassStatus.ACTIVE, BreakGlassRequest.expires_at > _now(),
    ).first()
    if not req:
        raise forbidden("Active emergency access is required")
    group = db.query(ReportGroup).filter(ReportGroup.id == data.group_id, ReportGroup.patient_id == req.patient_id).first()
    if not group:
        raise not_found("Patient report group")
    target_ids = sorted(set(data.doctor_ids) - {doctor.id})
    targets = db.query(User).filter(User.id.in_(target_ids), User.role == UserRole.DOCTOR, User.status == UserStatus.ACTIVE).all()
    if not target_ids or len(targets) != len(target_ids):
        raise bad_request("Select one or more active doctors")

    existing_ids = {row[0] for row in db.query(BreakGlassShare.recipient_id).join(BreakGlassRequest).filter(
        BreakGlassShare.group_id == group.id, BreakGlassRequest.status == BreakGlassStatus.ACTIVE,
        BreakGlassRequest.expires_at > _now()).all()}
    existing_ids.add(doctor.id)
    if len(existing_ids | set(target_ids)) > 3:
        approval = _create_permission_request(db, doctor, group, "BREAK_GLASS_SHARE",
            "Emergency read-only share; admin approval required because access would reach more than three doctors.",
            target_ids, req.id)
        return {"status": "PENDING_ADMIN_APPROVAL", "permission_request_id": approval.id}

    _create_emergency_shares(db, req, group, doctor, targets)
    db.commit()
    return {"status": "SHARED", "doctor_ids": target_ids}


def _create_emergency_shares(db: Session, req: BreakGlassRequest, group: ReportGroup, doctor: User, targets: list[User]) -> None:
    for target in targets:
        if db.query(BreakGlassShare.id).filter(BreakGlassShare.request_id == req.id,
                BreakGlassShare.group_id == group.id, BreakGlassShare.recipient_id == target.id).first():
            continue
        db.add(BreakGlassShare(request_id=req.id, group_id=group.id, shared_by=doctor.id, recipient_id=target.id))
        notification_service.create_notification(db, recipient_id=target.id, title="Emergency View-Only Record Access",
            message=f"Dr. {doctor.name} shared '{group.title}' with you for emergency view-only access.",
            type=NotificationType.EMERGENCY_SHARE_CREATED)
    notification_service.create_notification(db, recipient_id=req.patient_id, title="Emergency Record Shared",
        message=f"Dr. {doctor.name} shared '{group.title}' with other doctors for view-only emergency care.",
        type=NotificationType.EMERGENCY_SHARE_CREATED)
    db.add(BreakGlassAction(request_id=req.id, action="SHARE_CREATED", target_type="ReportGroup", target_id=group.id,
                            details={"recipient_ids": [target.id for target in targets], "can_view": True, "can_download": False}))


def list_permission_requests(db: Session):
    rows = db.query(AdminPermissionRequest).order_by(AdminPermissionRequest.created_at.desc()).limit(250).all()
    result = []
    for row in rows:
        requester = db.query(User).filter(User.id == row.requester_id).first()
        patient = db.query(User).filter(User.id == row.patient_id).first()
        group = db.query(ReportGroup).filter(ReportGroup.id == row.group_id).first()
        result.append({"id": row.id, "action": row.action, "requester_id": row.requester_id,
            "requester_name": requester.name if requester else None, "patient_id": row.patient_id,
            "patient_name": patient.name if patient else None, "group_id": row.group_id,
            "group_title": group.title if group else None, "doctor_ids": row.target_doctor_ids,
            "justification": row.justification, "status": row.status, "created_at": row.created_at})
    return result


def decide_permission_request(db: Session, request_id: int, approve: bool, admin: User) -> AdminPermissionRequest:
    permission = db.query(AdminPermissionRequest).filter(AdminPermissionRequest.id == request_id).first()
    if not permission:
        raise not_found("Permission request")
    if permission.status != "PENDING":
        raise bad_request("This permission request has already been decided")
    permission.status = "APPROVED" if approve else "REJECTED"
    permission.decided_by = admin.id
    permission.decided_at = _now()
    if approve and permission.action == "BREAK_GLASS_SHARE":
        req = db.query(BreakGlassRequest).filter(BreakGlassRequest.id == permission.break_glass_request_id,
            BreakGlassRequest.status == BreakGlassStatus.ACTIVE, BreakGlassRequest.expires_at > _now()).first()
        group = db.query(ReportGroup).filter(ReportGroup.id == permission.group_id).first()
        if req and group:
            targets = db.query(User).filter(User.id.in_(permission.target_doctor_ids or []), User.role == UserRole.DOCTOR,
                User.status == UserStatus.ACTIVE).all()
            _create_emergency_shares(db, req, group, db.query(User).filter(User.id == permission.requester_id).first(), targets)
        else:
            permission.status = "EXPIRED"
    requester = db.query(User).filter(User.id == permission.requester_id).first()
    if requester:
        notification_service.create_notification(db, recipient_id=requester.id, title="Admin Permission Decision",
            message=f"Your {permission.action.lower().replace('_', ' ')} request was {permission.status.lower()}.",
            type=NotificationType.GENERAL)
    audit_service.create_log(db, action="ADMIN_PERMISSION_DECIDED", actor=admin,
        target_type="AdminPermissionRequest", target_id=permission.id,
        details={"status": permission.status, "action": permission.action})
    db.commit()
    db.refresh(permission)
    return permission