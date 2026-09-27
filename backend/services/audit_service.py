"""Audit log service — create immutable audit entries."""
from typing import Any
from sqlalchemy.orm import Session

from models.audit import AuditLog
from models.user import User


def create_log(
    db: Session,
    *,
    action: str,
    actor: User | None = None,
    actor_id: int | None = None,
    actor_email: str | None = None,
    target_type: str | None = None,
    target_id: int | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """
    Create and persist an AuditLog entry.

    Pass either `actor` (User model) or explicit `actor_id`/`actor_email`.
    """
    if actor is not None:
        actor_id = actor.id
        actor_email = actor.email

    entry = AuditLog(
        actor_id=actor_id,
        actor_email=actor_email,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    db.flush()  # Gets the id without committing; caller commits
    return entry
