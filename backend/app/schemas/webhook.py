from datetime import datetime

from app.schemas.base import CamelModel


class WebhookOut(CamelModel):
    id: str
    url: str
    events: list[str]
    enabled: bool
    created_at: datetime
    signing_secret: str
    status: str
    status_detail: str | None
    checked_at: datetime | None


class CreateWebhookIn(CamelModel):
    url: str
    events: list[str]
