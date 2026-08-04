from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.ids import new_id


class AgentCallEvent(Base):
    """A real, timestamped report of calls an agent made — the only source
    an agent's call-volume numbers are computed from. Nothing here is
    inferred or estimated; if an agent never reports in, its volume is 0."""

    __tablename__ = "agent_call_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("evt"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)

    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
