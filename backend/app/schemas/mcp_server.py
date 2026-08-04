from datetime import datetime

from app.schemas.base import CamelModel


class McpServerOut(CamelModel):
    id: str
    name: str
    transport: str
    endpoint: str | None
    command: str | None
    args: list[str]
    description: str
    status: str
    status_detail: str | None
    checked_at: datetime | None
    created_at: datetime
    used_by_agent_count: int = 0


class CreateMcpServerIn(CamelModel):
    name: str
    transport: str = "http"
    endpoint: str | None = None
    command: str | None = None
    args: list[str] = []
    description: str = ""


class UpdateMcpServerIn(CamelModel):
    name: str
    transport: str
    endpoint: str | None = None
    command: str | None = None
    args: list[str] = []
    description: str


class ImportMcpServersIn(CamelModel):
    config: str
