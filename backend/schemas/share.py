"""Share-related Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel
from models.share import GranteeType


# ── Internal permission ───────────────────────────────────────────────────────

class PermissionGrantRequest(BaseModel):
    record_id: int
    grantee_type: GranteeType
    grantee_user_id: int | None = None
    grantee_spec_id: int | None = None
    can_view: bool = True
    can_download: bool = False
    can_share: bool = False


class PermissionUpdateRequest(BaseModel):
    can_view: bool
    can_download: bool
    can_share: bool


class GranteeBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class PermissionRead(BaseModel):
    id: int
    record_id: int
    granted_by: int
    grantee_type: GranteeType
    grantee_user_id: int | None
    grantee_spec_id: int | None
    grantee_name: str | None = None  # Filled in by service
    can_view: bool
    can_download: bool
    can_share: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── External share ────────────────────────────────────────────────────────────

class ExternalShareCreate(BaseModel):
    record_id: int
    label: str | None = None


class ExternalShareRead(BaseModel):
    id: int
    record_id: int
    created_by: int
    token: str
    label: str | None
    is_active: bool
    access_count: int
    expires_at: datetime | None
    created_at: datetime
    share_url: str = ""  # Populated by service/router
    qr_base64: str = ""  # Base64 PNG populated by service

    model_config = {"from_attributes": True}


# ── Public external view ──────────────────────────────────────────────────────

class PublicFileRead(BaseModel):
    id: int
    original_name: str
    mime_type: str
    sort_order: int


class PublicRecordRead(BaseModel):
    record_id: int
    group_title: str
    test_type: str
    record_date: datetime
    record_type: str
    notes: str | None
    lab_technician_name: str
    files: list[PublicFileRead]
    share_label: str | None
