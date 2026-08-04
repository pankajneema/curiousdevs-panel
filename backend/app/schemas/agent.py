from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel


class AgentOut(CamelModel):
    id: str
    name: str
    purpose: str
    owner_user_id: str | None
    environment: str
    connection_methods: list[str]
    status: str
    risk_band: str
    has_lethal_trifecta: bool
    agent_version: str
    expires_at: datetime | None
    created_at: datetime
    last_seen_at: datetime | None
    # to_camel's generic snake->camel conversion turns this into
    # "callVolume24H" (capitalizes the letter right after a digit) — the
    # frontend's Agent type expects "callVolume24h", so pin it explicitly.
    call_volume_24h: int = Field(alias="callVolume24h")


class CreateAgentIn(CamelModel):
    name: str
    purpose: str
    environment: str
    connection_methods: list[str]
    risk_band: str
    has_lethal_trifecta: bool = False
    owner_user_id: str | None = None
    expires_at: datetime | None = None


class UpdateAgentIn(CamelModel):
    name: str
    purpose: str
    environment: str
    connection_methods: list[str]
    risk_band: str
    has_lethal_trifecta: bool
    owner_user_id: str | None = None
    expires_at: datetime | None = None


class UpdateAgentStatusIn(CamelModel):
    status: str


class UpdateAgentPoliciesIn(CamelModel):
    policy_ids: list[str]


class AgentReportIn(CamelModel):
    """What an agent's own SDK sends on init/heartbeat — a self-report, not
    an admin edit. agent_version is a real build identifier if the caller
    has one; mcp_servers_config is the same {"mcpServers": {...}} shape used
    by the manual JSON import, describing what this agent is actually
    configured to use right now."""

    agent_version: str | None = None
    mcp_servers_config: str | None = None


class AgentActivityIn(CamelModel):
    """A real batch of calls an agent made — count defaults to 1 so a naive
    caller reporting after every single call still works without thinking
    about batching."""

    count: int = 1
    occurred_at: datetime | None = None
