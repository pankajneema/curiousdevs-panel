from datetime import datetime

from app.schemas.base import CamelModel


class BillingInfoOut(CamelModel):
    plan: str
    seats_included: int
    seats_used: int
    trial_ends_at: datetime | None


class UpgradePlanIn(CamelModel):
    plan: str


class PaymentMethodOut(CamelModel):
    brand: str
    last4: str
    exp_month: int
    exp_year: int


class AddPaymentMethodIn(CamelModel):
    card_number: str
    exp_month: int
    exp_year: int
    cvc: str
