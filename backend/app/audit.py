"""Records who did what to the org's real resources. Call `record()` in the
same transaction as the change it's describing — it only stages the row via
db.add(); the caller's own db.commit() persists both together, so a change
and its audit entry can never disagree about whether the other happened."""

from app.deps import DbSession
from app.models import AuditLogEntry, User


def record(
    db: DbSession,
    actor: User,
    action: str,
    target_type: str,
    target_id: str | None,
    target_label: str,
    summary: str,
) -> None:
    _write(db, actor.organization_id, actor.id, actor.name, action, target_type, target_id, target_label, summary)


def record_system(
    db: DbSession,
    organization_id: str,
    actor_label: str,
    action: str,
    target_type: str,
    target_id: str | None,
    target_label: str,
    summary: str,
) -> None:
    """Same as record(), for events with no signed-in user behind them — an
    agent's own SDK reporting in, a scheduled check, etc. actor_label is a
    human-readable stand-in (e.g. an agent's name) since there's no User row
    to attribute this to."""
    _write(db, organization_id, None, actor_label, action, target_type, target_id, target_label, summary)


def _write(
    db: DbSession,
    organization_id: str,
    actor_user_id: str | None,
    actor_name: str,
    action: str,
    target_type: str,
    target_id: str | None,
    target_label: str,
    summary: str,
) -> None:
    db.add(
        AuditLogEntry(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label,
            summary=summary,
        )
    )
