import secrets
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.ids import new_id


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("inv"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    invited_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")

    # The accept-invite link's identifier — separate from `id` so a leaked
    # invitation id (e.g. in a revoke API call) can't be used to accept it.
    token: Mapped[str] = mapped_column(String, unique=True, index=True, default=lambda: secrets.token_urlsafe(24))
    email_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")  # pending | sent | failed
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
