"""Shares router — internal permissions + external QR/link + group shares (Phase 4)."""
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from core.dependencies import get_active_user
from database import get_db
from models.user import User
from schemas.share import ExternalShareCreate, ExternalShareRead, PermissionGrantRequest, PermissionRead, PermissionUpdateRequest, PublicRecordRead
from schemas.group_share import GroupShareCreate, GroupShareRead, GroupShareUpdate, GroupShareDelegateCreate
from services import share_service, group_share_service

router = APIRouter(tags=["shares"])
public_router = APIRouter(tags=["public"])


# ── Internal per-record permissions ──────────────────────────────────────────

@router.post("/api/shares/internal", response_model=PermissionRead, status_code=201)
def grant_permission(data: PermissionGrantRequest, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return share_service.grant_permission(db, data, grantor=user)

@router.get("/api/shares/internal/{record_id}", response_model=list[PermissionRead])
def list_permissions(record_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return share_service.list_permissions(db, record_id, requester=user)

@router.patch("/api/shares/internal/perm/{perm_id}", response_model=PermissionRead)
def update_permission(perm_id: int, data: PermissionUpdateRequest, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return share_service.update_permission(db, perm_id, data, requester=user)

@router.delete("/api/shares/internal/perm/{perm_id}", status_code=204)
def revoke_permission(perm_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    share_service.revoke_permission(db, perm_id, requester=user)


# ── External shares ───────────────────────────────────────────────────────────

@router.post("/api/shares/external", response_model=ExternalShareRead, status_code=201)
def create_external_share(data: ExternalShareCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return share_service.create_external_share(db, data, creator=user)

@router.get("/api/shares/external/{record_id}", response_model=list[ExternalShareRead])
def list_external_shares(record_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return share_service.list_external_shares(db, record_id, requester=user)

@router.delete("/api/shares/external/{share_id}", status_code=204)
def revoke_external_share(share_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    share_service.revoke_external_share(db, share_id, requester=user)


# ── Group shares — version/file-aware (Phase 4) ───────────────────────────────

@router.post("/api/shares/group", response_model=GroupShareRead, status_code=201)
def create_group_share(data: GroupShareCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return group_share_service.create_group_share(db, data, grantor=user)

@router.get("/api/shares/group/{group_id}", response_model=list[GroupShareRead])
def list_group_shares(group_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return group_share_service.list_group_shares(db, group_id, requester=user)

@router.patch("/api/shares/group/{share_id}", response_model=GroupShareRead)
def update_group_share(share_id: int, data: GroupShareUpdate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return group_share_service.update_group_share(db, share_id, data, requester=user)

@router.delete("/api/shares/group/{share_id}", status_code=204)
def revoke_group_share(share_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    group_share_service.revoke_group_share(db, share_id, requester=user)

# ── Doctor-facing share endpoints ─────────────────────────────────────────────

@router.get("/api/shares/my", response_model=list[GroupShareRead])
def my_shares(user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Doctor lists all pending + accepted shares targeted at them."""
    return group_share_service.list_doctor_shares(db, user)

@router.post("/api/shares/group/{share_id}/accept", response_model=GroupShareRead)
def accept_share(share_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Doctor accepts a pending share → moves to normal dashboard."""
    return group_share_service.accept_group_share(db, share_id, doctor=user)

@router.post("/api/shares/group/{share_id}/delegate", response_model=GroupShareRead, status_code=201)
def delegate_share(share_id: int, data: GroupShareDelegateCreate, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    """Doctor delegates share to another doctor within original scope."""
    return group_share_service.delegate_group_share(db, share_id, data, doctor=user)


# ── Public (no auth) ──────────────────────────────────────────────────────────

@public_router.get("/api/public/shared/{token}", response_model=PublicRecordRead)
def public_view_record(token: str, request: Request, db: Session = Depends(get_db)):
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    return share_service.resolve_external_share(db, token, ip=ip)

@public_router.get("/api/public/shared/{token}/files/{file_id}/view")
def public_view_file(token: str, file_id: int, db: Session = Depends(get_db)):
    rf, data = share_service.get_file_for_external_view(db, token, file_id)
    return Response(content=data, media_type=rf.mime_type, headers={"Content-Disposition": f'inline; filename="{rf.original_name}"', "Cache-Control": "no-store"})
