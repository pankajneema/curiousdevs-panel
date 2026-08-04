from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

SEATS_BY_PLAN: dict[str, int] = {
    "trial": 10,
    "starter": 10,
    "growth": 50,
    "enterprise": 500,
}

TRIAL_LENGTH_DAYS = 14


class BillingAccount(Base):
    """One row per organization."""

    __tablename__ = "billing_accounts"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    plan: Mapped[str] = mapped_column(String, nullable=False, default="trial")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    brand: Mapped[str] = mapped_column(String, nullable=False)
    last4: Mapped[str] = mapped_column(String, nullable=False)
    exp_month: Mapped[int] = mapped_column(Integer, nullable=False)
    exp_year: Mapped[int] = mapped_column(Integer, nullable=False)
    holder_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
