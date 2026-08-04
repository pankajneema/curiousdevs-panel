from datetime import datetime

from app.schemas.base import CamelModel


class ApiKeyOut(CamelModel):
    id: str
    name: str
    prefix: str
    status: str
    agent_id: str | None
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None


class CreateApiKeyIn(CamelModel):
    name: str
    expires_at: datetime | None


class CreatedApiKeyOut(CamelModel):
    key: ApiKeyOut
    secret: str


class UpdateApiKeyStatusIn(CamelModel):
    status: str
