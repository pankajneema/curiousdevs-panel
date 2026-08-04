from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import AuditLogEntry
from app.schemas.audit_log import AuditLogEntryOut

router = APIRouter(prefix="/audit-log", tags=["audit-log"])


@router.get("", response_model=list[AuditLogEntryOut])
def list_audit_log(
    current_user: CurrentUser,
    db: DbSession,
    target_type: str | None = None,
    q: str | None = None,
) -> list[AuditLogEntryOut]:
    stmt = select(AuditLogEntry).where(AuditLogEntry.organization_id == current_user.organization_id)
    if target_type:
        stmt = stmt.where(AuditLogEntry.target_type == target_type)
    if q:
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            (AuditLogEntry.summary.ilike(needle))
            | (AuditLogEntry.target_label.ilike(needle))
            | (AuditLogEntry.actor_name.ilike(needle))
        )
    stmt = stmt.order_by(AuditLogEntry.created_at.desc()).limit(500)
    return list(db.scalars(stmt).all())
