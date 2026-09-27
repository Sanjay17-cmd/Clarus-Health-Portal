"""GroupShare Pydantic schemas — Phase 4 version/file-aware sharing with delegation."""
from datetime import datetime
from pydantic import BaseModel, field_validator
from models.group_share import GroupGranteeType, ShareStatus


class GroupShareCreate(BaseModel):
    group_id: int
    grantee_type: GroupGranteeType
    grantee_user_id: int | None = None
    grantee_spec_id: int | None = None
    # Version scope: 0=all, N>0=N most recent, or use record_ids for explicit selection
    max_versions: int = 0
    record_ids: list[int] | None = None  # explicit record selection (overrides max_versions)
    # Per-record file scope: dict of {record_id: [file_id, ...]}
    file_ids_by_record: dict[int, list[int]] | None = None
    can_view: bool = True
    can_download: bool = False
    can_share: bool = False
    can_delegate: bool = False

    @field_validator("max_versions")
    @classmethod
    def max_versions_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("max_versions must be >= 0 (0 = all records)")
        return v


class GroupShareUpdate(BaseModel):
    max_versions: int = 0
    can_view: bool = True
    can_download: bool = False
    can_share: bool = False
    can_delegate: bool = False


class GroupShareDelegateCreate(BaseModel):
    """Doctor delegates their access to another doctor (within original scope)."""
    grantee_user_id: int
    # Optionally restrict further
    record_ids: list[int] | None = None
    file_ids_by_record: dict[int, list[int]] | None = None
    can_download: bool = False  # Cannot escalate download permission from parent


class ShareScopeRecord(BaseModel):
    record_id: int
    file_ids: list[int] | None = None  # None = all files allowed for this record


class GroupShareRead(BaseModel):
    id: int
    group_id: int
    granted_by: int
    grantee_type: GroupGranteeType
    grantee_user_id: int | None
    grantee_spec_id: int | None
    grantee_name: str | None = None
    max_versions: int
    can_view: bool
    can_download: bool
    can_share: bool
    can_delegate: bool
    is_active: bool
    status: ShareStatus
    parent_share_id: int | None = None
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Scope summary (populated from service)
    allowed_record_ids: list[int] | None = None
    allowed_file_ids_by_record: dict[int, list[int]] | None = None
    # Group info for display
    group_title: str | None = None
    patient_name: str | None = None
    patient_id: int | None = None

    model_config = {"from_attributes": True}
