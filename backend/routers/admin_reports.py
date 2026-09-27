"""Admin reports router — corrections, deletion requests, archives (Phase 3A)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from core.dependencies import require_admin
from database import get_db
from models.user import User
from services import deletion_service, archive_service
from schemas.deletion import DeletionReviewRequest

router = APIRouter(prefix="/api/admin", tags=["admin-reports"])


# ── Corrections ───────────────────────────────────────────────────────────────
@router.get("/corrections")
def list_corrections(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """All CORRECTION records with old/new record metadata. No file content."""
    from models.report import ReportRecord, RecordType, SuspensionStatus
    from sqlalchemy.orm import joinedload
    corrections = (
        db.query(ReportRecord)
        .options(joinedload(ReportRecord.group), joinedload(ReportRecord.lab_technician))
        .filter(ReportRecord.record_type == RecordType.CORRECTION)
        .order_by(ReportRecord.created_at.desc())
        .limit(500)
        .all()
    )
    result = []
    for c in corrections:
        orig = None
        if c.corrects_record_id:
            orig = db.query(ReportRecord).filter(ReportRecord.id == c.corrects_record_id).first()
        result.append({
            "correction_id": c.id,
            "group_id": c.group_id,
            "group_title": c.group.title if c.group else "",
            "patient_id": c.group.patient_id if c.group else None,
            "patient_name": c.group.patient.name if c.group and c.group.patient else "",
            "technician_id": c.lab_technician_id,
            "technician_name": c.lab_technician_name,
            "correction_date": c.record_date,
            "correction_notes": c.notes,
            "correction_created_at": c.created_at,
            "suspension_status": c.suspension_status,
            "file_count": sum(1 for f in c.files if f.is_active),
            "file_names": [f.original_name for f in c.files if f.is_active],
            "corrects_record_id": c.corrects_record_id,
            "original_record_date": orig.record_date if orig else None,
            "original_record_type": orig.record_type if orig else None,
            "original_notes": orig.notes if orig else None,
            "original_technician_name": orig.lab_technician_name if orig else None,
            "original_created_at": orig.created_at if orig else None,
        })
    return result


# ── Deletion requests ─────────────────────────────────────────────────────────
@router.get("/deletion-requests")
def list_deletion_requests(
    status: str | None = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return deletion_service.list_deletion_requests(db, status=status)


@router.post("/deletion-requests/{request_id}/restore")
def restore_record(
    request_id: int,
    body: DeletionReviewRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return deletion_service.admin_restore(db, request_id, admin, review_notes=body.review_notes)


@router.post("/deletion-requests/{request_id}/permanently-delete")
def permanently_delete(
    request_id: int,
    body: DeletionReviewRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    deletion_service.admin_permanent_delete(db, request_id, admin, review_notes=body.review_notes)
    return {"detail": "Record permanently deleted and moved to recycle bin"}


# ── Archives ──────────────────────────────────────────────────────────────────
@router.get("/exports")
def list_exports(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return archive_service.list_exports(db)


@router.get("/imports")
def list_imports(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return archive_service.list_imports(db)
