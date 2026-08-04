from datetime import datetime

from app.schemas.base import CamelModel


class IntegrationOut(CamelModel):
    id: str
    organization_id: str
    kind: str
    label: str
    connected_at: datetime
    status: str
    status_detail: str | None
    checked_at: datetime | None


class ConnectIntegrationIn(CamelModel):
    kind: str
    label: str
