"""Archive router — ZIP export and import (Phase 3A)."""
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from core.dependencies import get_active_user
from core.exceptions import forbidden
from database import get_db
from models.user import User, UserRole
from services import archive_service

router = APIRouter(prefix="/api/archive", tags=["archive"])


@router.get("/export/{group_id}")
def export_zip(
    group_id: int,
    record_ids: str | None = Query(None, description="Comma-separated record IDs, omit for all"),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Download a real ZIP of the report group. Doctors need can_download permission."""
    if user.role not in (UserRole.DOCTOR, UserRole.PATIENT, UserRole.ADMIN):
        raise forbidden("Only doctors, patients, and admins can export archives")
    ids = [int(x) for x in record_ids.split(",") if x.strip().isdigit()] if record_ids else None
    zip_bytes, export_id = archive_service.export_zip(db, group_id, ids, exporter=user)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="clarus_export_{export_id}.zip"'},
    )


@router.post("/import")
async def import_zip(
    patient_id: int = Form(...),
    group_id: int | None = Form(None),
    import_notes: str | None = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Import a Clarus-exported ZIP. Doctor selects patient; server validates metadata.json match."""
    if user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise forbidden("Only doctors and admins can import archives")
    zip_bytes = await file.read()
    result = archive_service.import_zip(db, zip_bytes, patient_id=patient_id, group_id=group_id, importer=user, import_notes=import_notes)
    return result
