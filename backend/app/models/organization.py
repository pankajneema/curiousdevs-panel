from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.ids import new_id


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("org"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    domain_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Set whenever the domain changes (or is first set) and cleared once
    # verified — the value the caller must publish in a DNS TXT record to
    # prove ownership. Real ownership check, not a rubber stamp.
    domain_verify_token: Mapped[str | None] = mapped_column(String, nullable=True)
    data_residency: Mapped[str] = mapped_column(String, nullable=False, default="in")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
