"""Archive (ZIP export/import) Pydantic schemas — Phase 3A."""
from datetime import datetime
from pydantic import BaseModel


class ZipExportRead(BaseModel):
    id: str
    exported_by: int
    exporter_name: str = ""
    patient_id: int
    patient_name: str = ""
    group_id: int
    group_title: str = ""
    record_ids: list[int]
    file_count: int
    technician_id: int | None
    technician_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ZipImportRead(BaseModel):
    id: str
    original_export_id: str | None
    imported_by: int
    importer_name: str = ""
    patient_id: int
    patient_name: str = ""
    group_id: int | None
    group_title: str | None = None
    original_exporter_id: int | None
    original_exporter_name: str | None = None
    record_ids_imported: list[int]
    file_count: int
    import_notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
