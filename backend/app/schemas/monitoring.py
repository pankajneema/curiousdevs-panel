from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel


class MonitoringHourlyBucket(CamelModel):
    hour_start: datetime
    call_count: int


class MonitoringAgentRow(CamelModel):
    agent_id: str
    agent_name: str
    environment: str
    status: str
    # to_camel capitalizes the letter right after a digit ("callVolume24H"),
    # but the frontend expects "callVolume24h" — pin it explicitly, same fix
    # as AgentOut.call_volume_24h.
    call_volume_24h: int = Field(alias="callVolume24h")
    last_seen_at: datetime | None


class MonitoringOverviewOut(CamelModel):
    total_calls_24h: int = Field(alias="totalCalls24h")
    active_agents_24h: int = Field(alias="activeAgents24h")
    idle_agents: int
    hourly_buckets: list[MonitoringHourlyBucket]
    agents: list[MonitoringAgentRow]
