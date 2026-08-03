from datetime import datetime

from app.schemas.base import CamelModel


class AgentOut(CamelModel):
    id: str
    name: str
    purpose: str
    owner_user_id: str | None
    environment: str
    connection_method: str
    status: str
    risk_band: str
    has_lethal_trifecta: bool
    agent_version: str
    expires_at: datetime | None
    created_at: datetime
    last_seen_at: datetime | None
    call_volume_24h: int
