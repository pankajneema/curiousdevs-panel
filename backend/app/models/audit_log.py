from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.ids import new_id


class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("aud"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Denormalized rather than a live FK to users — the actor's name at the
    # time of the action should survive that user later being removed.
    actor_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    actor_name: Mapped[str] = mapped_column(String, nullable=False)

    action: Mapped[str] = mapped_column(String, nullable=False, index=True)  # e.g. "agent.created"
    target_type: Mapped[str] = mapped_column(String, nullable=False, index=True)  # e.g. "agent"
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    target_label: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
