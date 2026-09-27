"""Patient activity feed service (provenance timeline)."""
from __future__ import annotations
from sqlalchemy.orm import Session
from models.access_event import RecordAccessEvent
from models.user import User
from models.report import ReportGroup


def log_access_event(db: Session, record_id: int, patient_id: int, event_type: str,
                     actor_id: int | None = None, actor_role: str | None = None,
                     group_id: int | None = None, details: dict | None = None,
                     commit: bool = True) -> None:
    """Append-only: log an observable access event for the patient timeline."""
    ev = RecordAccessEvent(
        record_id=record_id,
        group_id=group_id,
        patient_id=patient_id,
        actor_id=actor_id,
        actor_role=actor_role,
        event_type=event_type,
        details=details,
    )
    db.add(ev)
    if commit:
        db.commit()


def get_patient_activity(db: Session, patient_id: int, limit: int = 100) -> list[dict]:
    """Return patient-visible events enriched with actor name and group title."""
    events = (
        db.query(RecordAccessEvent)
        .filter(RecordAccessEvent.patient_id == patient_id)
        .order_by(RecordAccessEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    actor_cache: dict[int, str] = {}
    group_cache: dict[int, str] = {}

    def actor_name(actor_id: int | None) -> str | None:
        if actor_id is None:
            return None
        if actor_id not in actor_cache:
            u = db.query(User).filter(User.id == actor_id).first()
            actor_cache[actor_id] = u.name if u else f"User #{actor_id}"
        return actor_cache[actor_id]

    def group_title(group_id: int | None) -> str | None:
        if group_id is None:
            return None
        if group_id not in group_cache:
            g = db.query(ReportGroup).filter(ReportGroup.id == group_id).first()
            group_cache[group_id] = g.title if g else None
        return group_cache[group_id]

    return [
        {
            "id": ev.id,
            "record_id": ev.record_id,
            "group_id": ev.group_id,
            "group_title": group_title(ev.group_id),
            "patient_id": ev.patient_id,
            "actor_id": ev.actor_id,
            "actor_name": actor_name(ev.actor_id),
            "actor_role": ev.actor_role,
            "event_type": ev.event_type,
            "details": ev.details,
            "created_at": ev.created_at,
        }
        for ev in events
    ]
