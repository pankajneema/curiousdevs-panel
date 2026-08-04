from datetime import UTC, datetime

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.ids import new_id
from app.models.mcp_server import McpServer, agent_mcp_servers
from app.models.policy import Policy, agent_policies


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("agt"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    owner_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    environment: Mapped[str] = mapped_column(String, nullable=False)
    # An agent isn't limited to one integration surface — it can be reachable
    # over several at once (e.g. both MCP and a direct SDK connection).
    connection_methods: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    risk_band: Mapped[str] = mapped_column(String, nullable=False, default="low")
    has_lethal_trifecta: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    agent_version: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # No stored counter here on purpose — call volume is always computed
    # live from AgentCallEvent rows (see agents.py's agent_to_out), so it
    # can never drift from what was actually reported.

    policies: Mapped[list[Policy]] = relationship("Policy", secondary=agent_policies)
    # Populated by the agent's own self-report call (POST /agents/{id}/report),
    # not by an admin — this reflects what the agent actually told AgentGuard
    # it's configured to use, not a manually-curated list.
    mcp_servers: Mapped[list[McpServer]] = relationship("McpServer", secondary=agent_mcp_servers)
