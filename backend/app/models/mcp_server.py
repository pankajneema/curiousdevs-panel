from datetime import UTC, datetime

from sqlalchemy import ARRAY, Column, DateTime, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.ids import new_id

agent_mcp_servers = Table(
    "agent_mcp_servers",
    Base.metadata,
    Column("agent_id", ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("mcp_server_id", ForeignKey("mcp_servers.id", ondelete="CASCADE"), primary_key=True),
)


class McpServer(Base):
    __tablename__ = "mcp_servers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("mcp"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # "http" — a remote, network-reachable server (Streamable HTTP or SSE),
    # identified by a URL. "stdio" — a local process the agent's own host
    # launches directly; there's no network endpoint for this backend to
    # ever reach, so it can only be recorded, never health-checked.
    transport: Mapped[str] = mapped_column(String, nullable=False, default="http")
    endpoint: Mapped[str | None] = mapped_column(String, nullable=True)
    command: Mapped[str | None] = mapped_column(String, nullable=True)
    args: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    # Set by a background task right after creation (and after every edit)
    # for "http" servers, which actually speaks MCP's JSON-RPC handshake to
    # the endpoint rather than just accepting whatever URL was typed in.
    # "stdio" servers are stamped "local" and never enter pending/reachable/
    # unreachable — there's nothing this backend can dial.
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    status_detail: Mapped[str | None] = mapped_column(String, nullable=True)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
