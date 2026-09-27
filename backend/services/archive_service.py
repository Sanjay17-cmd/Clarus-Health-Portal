"""Archive service — real ZIP export/import with provenance (Phase 3A).

Export layout:
  clarus_export_<export_id>/
    metadata.json
    records/
      <record_id>/
        <file_uuid>_<original_name>

Import validates:
  - ZIP structure
  - metadata.json integrity
  - No path traversal
  - patient_id matches selected patient
  - No duplicate import of same export_id
"""
import hashlib
import io
import json
import os
import re
import uuid
import zipfile
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from config import settings
from core.exceptions import bad_request, forbidden, not_found
from models.archive import ZipExport, ZipImport
from models.notification import NotificationType
from models.report import ReportFile, ReportGroup, ReportRecord, RecordType, SuspensionStatus
from models.user import User, UserRole
from schemas.archive import ZipExportRead, ZipImportRead
from services import audit_service, notification_service
from storage.service import storage

SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
MAX_ZIP_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB hard limit


# ── Export ────────────────────────────────────────────────────────────────────

def export_zip(
    db: Session,
    group_id: int,
    record_ids: list[int] | None,
    exporter: User,
) -> tuple[bytes, str]:
    """
    Build a real ZIP for the given group + optional record_ids subset.
    Returns (zip_bytes, export_id).
    Only doctors with can_download (via GroupShare or per-record perm) and patients who own
    the group may export. Admins may always export.
    """
    group = db.query(ReportGroup).options(
        joinedload(ReportGroup.patient)
    ).filter(ReportGroup.id == group_id, ReportGroup.is_active == 1).first()
    if not group:
        raise not_found("Report Group")

    # Authorisation
    _assert_can_export(db, group, exporter)

    # Determine records to include
    all_records = (
        db.query(ReportRecord)
        .options(joinedload(ReportRecord.files))
        .filter(
            ReportRecord.group_id == group_id,
            ReportRecord.is_active == 1,
            ReportRecord.suspension_status == SuspensionStatus.ACTIVE,
        )
        .order_by(ReportRecord.record_date.desc())
        .all()
    )

    if record_ids:
        id_set = set(record_ids)
        records = [r for r in all_records if r.id in id_set]
    else:
        records = all_records

    if not records:
        raise bad_request("No accessible records to export")

    export_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Collect file checksums and build ZIP in memory
    file_metadata = []
    total_files = 0
    primary_tech_id: int | None = None

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        prefix = f"clarus_export_{export_id}/"

        for record in records:
            active_files = [f for f in record.files if f.is_active]
            total_files += len(active_files)
            if primary_tech_id is None and active_files:
                primary_tech_id = active_files[0].uploaded_by

            for rf in active_files:
                try:
                    file_bytes = storage.read(rf.stored_path)
                except FileNotFoundError:
                    continue
                sha256 = hashlib.sha256(file_bytes).hexdigest()
                safe_name = re.sub(r"[^\w.\-]", "_", rf.original_name)
                arc_path = f"{prefix}records/{record.id}/{rf.id}_{safe_name}"
                zf.writestr(arc_path, file_bytes)
                file_metadata.append({
                    "record_id": record.id,
                    "file_id": rf.id,
                    "original_name": rf.original_name,
                    "stored_arc_path": arc_path,
                    "mime_type": rf.mime_type,
                    "file_size": rf.file_size,
                    "sha256": sha256,
                })

        # Build metadata.json
        tech = None
        if primary_tech_id:
            from models.user import User as UModel
            tech = db.query(UModel).filter(UModel.id == primary_tech_id).first()

        meta = {
            "clarus_export_version": "4A",
            "export_id": export_id,
            "export_token": export_id,  # Phase 4: for ShareImport provenance linking
            "exported_at": now.isoformat(),

            "exported_by": {
                "id": exporter.id,
                "name": exporter.name,
                "email": exporter.email,
                "role": exporter.role,
            },
            "patient": {
                "id": group.patient_id,
                "name": group.patient.name if group.patient else "",
                "email": group.patient.email if group.patient else "",
            },
            "report_group": {
                "id": group.id,
                "title": group.title,
                "test_type": group.test_type,
            },
            "records": [
                {
                    "id": r.id,
                    "record_type": r.record_type,
                    "record_date": r.record_date.isoformat(),
                    "notes": r.notes,
                    "lab_technician_id": r.lab_technician_id,
                    "lab_technician_name": r.lab_technician_name,
                    "corrects_record_id": r.corrects_record_id,
                }
                for r in records
            ],
            "lab_technician": {
                "id": tech.id if tech else None,
                "name": tech.name if tech else None,
            },
            "files": file_metadata,
        }
        zf.writestr(f"{prefix}metadata.json", json.dumps(meta, indent=2, default=str))

    zip_bytes = buf.getvalue()

    # Persist provenance
    ze = ZipExport(
        id=export_id,
        exported_by=exporter.id,
        patient_id=group.patient_id,
        group_id=group_id,
        record_ids=[r.id for r in records],
        file_count=total_files,
        technician_id=primary_tech_id,
    )
    db.add(ze)

    # Notify patient if doctor exported
    if exporter.role == UserRole.DOCTOR:
        notification_service.create_notification(
            db,
            recipient_id=group.patient_id,
            title="Your Records Were Exported",
            message=f"Dr. {exporter.name} exported '{group.title}' as a ZIP archive.",
            type=NotificationType.ZIP_EXPORTED,
        )

    audit_service.create_log(
        db, action="ZIP_EXPORTED", actor=exporter,
        target_type="ZipExport", target_id=export_id,
        details={"group_id": group_id, "record_count": len(records), "file_count": total_files},
    )
    db.commit()
    return zip_bytes, export_id


# ── Import ────────────────────────────────────────────────────────────────────

def import_zip(
    db: Session,
    zip_bytes: bytes,
    patient_id: int,
    group_id: int | None,
    importer: User,
    import_notes: str | None = None,
) -> ZipImportRead:
    """
    Import a Clarus ZIP. Validates structure, metadata.json, patient match,
    then registers new records+files and creates provenance.
    """
    if importer.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise forbidden("Only doctors and admins can import archives")

    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise bad_request("ZIP file exceeds 500 MB limit")

    # Validate target patient
    from models.user import User as UModel
    patient = db.query(UModel).filter(
        UModel.id == patient_id, UModel.role == UserRole.PATIENT
    ).first()
    if not patient:
        raise not_found("Patient")

    # Open and validate ZIP
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise bad_request("Uploaded file is not a valid ZIP archive")

    names = zf.namelist()

    # Detect prefix and metadata.json
    meta_entry = next((n for n in names if n.endswith("metadata.json")), None)
    if not meta_entry:
        raise bad_request("ZIP is missing metadata.json — not a valid Clarus export")

    try:
        meta = json.loads(zf.read(meta_entry).decode("utf-8"))
    except Exception:
        raise bad_request("metadata.json is corrupt or not valid JSON")

    _validate_metadata_structure(meta)

    # Validate patient match
    meta_patient_id = meta["patient"]["id"]
    if int(meta_patient_id) != patient_id:
        raise bad_request(
            f"ZIP contains records for patient ID {meta_patient_id}, "
            f"but you selected patient ID {patient_id}. They must match."
        )

    # Check for duplicate import
    original_export_id = meta.get("export_id")
    if original_export_id:
        dup = db.query(ZipImport).filter(
            ZipImport.original_export_id == original_export_id
        ).first()
        if dup:
            raise bad_request(
                f"This ZIP was already imported (import ID: {dup.id}). "
                "Duplicate imports are not allowed."
            )

    # Resolve or create group
    if group_id:
        group = db.query(ReportGroup).filter(
            ReportGroup.id == group_id,
            ReportGroup.patient_id == patient_id,
            ReportGroup.is_active == 1,
        ).first()
        if not group:
            raise bad_request("Selected report group does not belong to this patient")
    else:
        meta_group = meta.get("report_group", {})
        group = ReportGroup(
            patient_id=patient_id,
            title=f"[Imported] {meta_group.get('title', 'Unknown')}",
            test_type=meta_group.get("test_type", "Imported"),
            description=f"Imported from ZIP export {original_export_id}",
            created_by=importer.id,
        )
        db.add(group)
        db.flush()

    # Extract files safely (anti path-traversal)
    prefix = meta_entry.rsplit("metadata.json", 1)[0]
    file_meta_by_id = {str(f["file_id"]): f for f in meta.get("files", [])}

    imported_record_ids = []
    total_files = 0
    original_exporter_id: int | None = None
    try:
        original_exporter_id = int(meta["exported_by"]["id"])
    except Exception:
        pass

    for rec_meta in meta.get("records", []):
        record = ReportRecord(
            group_id=group.id,
            record_type=RecordType(rec_meta.get("record_type", "ORIGINAL")),
            record_date=datetime.fromisoformat(rec_meta["record_date"]),
            notes=rec_meta.get("notes"),
            lab_technician_id=importer.id,
            lab_technician_name=f"{rec_meta.get('lab_technician_name', 'Unknown')} [via import by {importer.name}]",
            corrects_record_id=None,  # Imported corrections cannot reference original IDs
        )
        db.add(record)
        db.flush()
        imported_record_ids.append(record.id)

        # Find files belonging to this record in the ZIP
        for entry_name in names:
            if not entry_name.startswith(f"{prefix}records/{rec_meta['id']}/"):
                continue
            _assert_safe_path(entry_name)

            file_info = zf.getinfo(entry_name)
            if file_info.is_dir():
                continue

            raw = zf.read(entry_name)
            basename = os.path.basename(entry_name)

            # Determine original name from metadata
            file_id_str = basename.split("_", 1)[0] if "_" in basename else ""
            fmeta = file_meta_by_id.get(file_id_str, {})
            original_name = fmeta.get("original_name", basename)
            mime = fmeta.get("mime_type", "application/octet-stream")

            # Validate checksum if present
            expected_sha = fmeta.get("sha256")
            if expected_sha:
                actual_sha = hashlib.sha256(raw).hexdigest()
                if actual_sha != expected_sha:
                    raise bad_request(f"Checksum mismatch for file '{original_name}'")

            stored_path = storage.generate_path(original_name, subfolder="imports")
            storage.save(raw, stored_path)

            rf = ReportFile(
                record_id=record.id,
                original_name=original_name,
                stored_path=stored_path,
                mime_type=mime,
                file_size=len(raw),
                sort_order=total_files,
                uploaded_by=importer.id,
            )
            db.add(rf)
            total_files += 1

    import_id = str(uuid.uuid4())
    zi = ZipImport(
        id=import_id,
        original_export_id=original_export_id,
        imported_by=importer.id,
        patient_id=patient_id,
        group_id=group.id,
        original_exporter_id=original_exporter_id,
        record_ids_imported=imported_record_ids,
        file_count=total_files,
        import_notes=import_notes,
    )
    db.add(zi)

    # Phase 4: Write share provenance row to share_imports
    try:
        from services.group_share_service import record_share_import
        export_token = meta.get("export_token") or meta.get("export_id")
        record_share_import(
            db,
            imported_by=importer.id,
            patient_id=patient_id,
            export_token=export_token,
            import_metadata=meta,
        )
    except Exception:
        pass  # Never block import due to provenance error

    # Notify patient

    orig_name = meta.get("exported_by", {}).get("name", "Unknown")
    notification_service.create_notification(
        db,
        recipient_id=patient_id,
        title="Records Imported Into Your Profile",
        message=f"Dr. {importer.name} imported records previously exported by {orig_name}.",
        type=NotificationType.ZIP_IMPORTED,
    )

    audit_service.create_log(
        db, action="ZIP_IMPORTED", actor=importer,
        target_type="ZipImport", target_id=import_id,
        details={
            "original_export_id": original_export_id,
            "patient_id": patient_id,
            "records_imported": len(imported_record_ids),
            "file_count": total_files,
        },
    )
    db.commit()

    return ZipImportRead(
        id=import_id,
        original_export_id=original_export_id,
        imported_by=importer.id,
        importer_name=importer.name,
        patient_id=patient_id,
        patient_name=patient.name,
        group_id=group.id,
        group_title=group.title,
        original_exporter_id=original_exporter_id,
        original_exporter_name=meta.get("exported_by", {}).get("name"),
        record_ids_imported=imported_record_ids,
        file_count=total_files,
        import_notes=import_notes,
        created_at=datetime.now(timezone.utc),
    )


# ── Admin listing ─────────────────────────────────────────────────────────────

def list_exports(db: Session) -> list[dict]:
    rows = db.query(ZipExport).options(
        joinedload(ZipExport.exporter),
        joinedload(ZipExport.patient),
        joinedload(ZipExport.group),
    ).order_by(ZipExport.created_at.desc()).limit(500).all()

    return [
        {
            "id": r.id,
            "exported_by": r.exported_by,
            "exporter_name": r.exporter.name if r.exporter else "",
            "patient_id": r.patient_id,
            "patient_name": r.patient.name if r.patient else "",
            "group_id": r.group_id,
            "group_title": r.group.title if r.group else "",
            "record_ids": r.record_ids,
            "file_count": r.file_count,
            "technician_id": r.technician_id,
            "technician_name": None,
            "created_at": r.created_at,
        }
        for r in rows
    ]


def list_imports(db: Session) -> list[dict]:
    rows = db.query(ZipImport).options(
        joinedload(ZipImport.importer),
        joinedload(ZipImport.patient),
        joinedload(ZipImport.original_exporter),
    ).order_by(ZipImport.created_at.desc()).limit(500).all()

    return [
        {
            "id": r.id,
            "original_export_id": r.original_export_id,
            "imported_by": r.imported_by,
            "importer_name": r.importer.name if r.importer else "",
            "patient_id": r.patient_id,
            "patient_name": r.patient.name if r.patient else "",
            "group_id": r.group_id,
            "group_title": None,
            "original_exporter_id": r.original_exporter_id,
            "original_exporter_name": r.original_exporter.name if r.original_exporter else None,
            "record_ids_imported": r.record_ids_imported,
            "file_count": r.file_count,
            "import_notes": r.import_notes,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_can_export(db: Session, group: ReportGroup, exporter: User) -> None:
    if exporter.role == UserRole.ADMIN:
        return
    if exporter.role == UserRole.PATIENT and group.patient_id == exporter.id:
        return
    if exporter.role == UserRole.DOCTOR:
        from services.group_share_service import get_doctor_download_permission
        if get_doctor_download_permission(db, group.id, exporter):
            return
        # Also check per-record permissions
        from models.share import ReportPermission, GranteeType
        from sqlalchemy import or_
        record_ids = db.query(ReportRecord.id).filter(
            ReportRecord.group_id == group.id,
            ReportRecord.is_active == 1,
        ).all()
        rid_list = [r.id for r in record_ids]
        if rid_list:
            perm = db.query(ReportPermission).filter(
                ReportPermission.record_id.in_(rid_list),
                ReportPermission.can_download == 1,
                or_(
                    (ReportPermission.grantee_type == GranteeType.USER) & (ReportPermission.grantee_user_id == exporter.id),
                    (ReportPermission.grantee_type == GranteeType.SPECIALIZATION) & (ReportPermission.grantee_spec_id == exporter.specialization_id),
                )
            ).first()
            if perm:
                return
        raise forbidden("You do not have download permission for this report group")
    raise forbidden()


def _validate_metadata_structure(meta: dict) -> None:
    required = ["clarus_export_version", "export_id", "patient", "report_group", "records", "files"]
    for field in required:
        if field not in meta:
            raise bad_request(f"metadata.json is missing required field: '{field}'")
    if not isinstance(meta.get("patient", {}).get("id"), (int, str)):
        raise bad_request("metadata.json: patient.id is missing or invalid")
    if not isinstance(meta.get("records"), list):
        raise bad_request("metadata.json: records must be a list")


def _assert_safe_path(path: str) -> None:
    """Reject any path containing traversal sequences."""
    normalized = os.path.normpath(path)
    if ".." in normalized.split(os.sep):
        raise bad_request(f"Unsafe path detected in ZIP: {path}")
    parts = path.replace("\\", "/").split("/")
    for part in parts:
        if part in ("", ".", ".."):
            continue
