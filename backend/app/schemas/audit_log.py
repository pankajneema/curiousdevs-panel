from datetime import datetime

from app.schemas.base import CamelModel


class AuditLogEntryOut(CamelModel):
    id: str
    actor_user_id: str | None
    actor_name: str
    action: str
    target_type: str
    target_id: str | None
    target_label: str
    summary: str
    created_at: datetime
