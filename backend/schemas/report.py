"""Report-related Pydantic schemas."""
from datetime import datetime
from pydantic import BaseModel, field_validator
from models.report import RecordType, SuspensionStatus


# ── File ──────────────────────────────────────────────────────────────────────

class ReportFileRead(BaseModel):
    id: int
    record_id: int
    original_name: str
    mime_type: str
    file_size: int
    sort_order: int
    uploaded_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Record ────────────────────────────────────────────────────────────────────

class ReportRecordCreate(BaseModel):
    record_type: RecordType = RecordType.ORIGINAL
    corrects_record_id: int | None = None
    record_date: datetime
    notes: str | None = None


class ReportRecordRead(BaseModel):
    id: int
    group_id: int
    record_type: RecordType
    corrects_record_id: int | None
    corrects_record_date: datetime | None = None   # Populated by service
    record_date: datetime
    notes: str | None
    lab_technician_id: int
    lab_technician_name: str
    is_active: bool
    suspension_status: SuspensionStatus = SuspensionStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    files: list[ReportFileRead] = []
    archive_metadata: dict | None = None

    model_config = {"from_attributes": True}


class ReportRecordBrief(BaseModel):
    id: int
    group_id: int
    record_type: RecordType
    corrects_record_id: int | None
    record_date: datetime
    lab_technician_name: str
    file_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Group ─────────────────────────────────────────────────────────────────────

class ReportGroupCreate(BaseModel):
    title: str
    test_type: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title must not be empty")
        return v

    @field_validator("test_type")
    @classmethod
    def test_type_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Test type must not be empty")
        return v


class ReportGroupRead(BaseModel):
    id: int
    patient_id: int
    title: str
    test_type: str
    description: str | None
    is_active: bool
    created_by: int
    created_at: datetime
    updated_at: datetime
    record_count: int = 0
    latest_record_date: datetime | None = None
    emergency_access: bool = False
    break_glass_request_id: int | None = None
    break_glass_doctor_id: int | None = None
    can_emergency_share: bool = False

    model_config = {"from_attributes": True}


class ReportGroupDetail(ReportGroupRead):
    records: list[ReportRecordBrief] = []


# ── Patient listing ───────────────────────────────────────────────────────────

class PatientBrief(BaseModel):
    id: int
    name: str
    email: str

    model_config = {"from_attributes": True}
