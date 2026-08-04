import re
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import BillingAccount, Organization, PaymentMethod, User
from app.models.billing import SEATS_BY_PLAN, TRIAL_LENGTH_DAYS
from app.schemas.billing import AddPaymentMethodIn, BillingInfoOut, PaymentMethodOut, UpgradePlanIn

router = APIRouter(prefix="/billing", tags=["billing"])


def _get_or_create_account(db: DbSession, organization_id: str) -> BillingAccount:
    account = db.get(BillingAccount, organization_id)
    if not account:
        account = BillingAccount(organization_id=organization_id, plan="trial")
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


@router.get("", response_model=BillingInfoOut)
def get_billing(current_user: CurrentUser, db: DbSession) -> BillingInfoOut:
    account = _get_or_create_account(db, current_user.organization_id)
    org = db.get(Organization, current_user.organization_id)
    seats_used = db.scalar(
        select(func.count(User.id)).where(User.organization_id == current_user.organization_id)
    )
    trial_ends_at = None
    if account.plan == "trial":
        trial_ends_at = org.created_at + timedelta(days=TRIAL_LENGTH_DAYS)
    return BillingInfoOut(
        plan=account.plan,
        seats_included=SEATS_BY_PLAN.get(account.plan, 10),
        seats_used=seats_used or 0,
        trial_ends_at=trial_ends_at,
    )


@router.post("/upgrade", response_model=BillingInfoOut)
def upgrade_plan(payload: UpgradePlanIn, current_user: CurrentUser, db: DbSession) -> BillingInfoOut:
    if not db.get(PaymentMethod, current_user.organization_id):
        raise api_error("Add a payment method before upgrading.")
    account = _get_or_create_account(db, current_user.organization_id)
    account.plan = payload.plan
    db.commit()
    return get_billing(current_user, db)


@router.get("/payment-method", response_model=PaymentMethodOut | None)
def get_payment_method(current_user: CurrentUser, db: DbSession) -> PaymentMethodOut | None:
    method = db.get(PaymentMethod, current_user.organization_id)
    return PaymentMethodOut.model_validate(method) if method else None


def _detect_brand(digits: str) -> str:
    if digits.startswith(("34", "37")):
        return "American Express"
    if digits.startswith("5"):
        return "Mastercard"
    return "Visa"


@router.post("/payment-method", response_model=PaymentMethodOut)
def add_payment_method(payload: AddPaymentMethodIn, current_user: CurrentUser, db: DbSession) -> PaymentMethodOut:
    digits = re.sub(r"\s+", "", payload.card_number)
    if not re.fullmatch(r"\d{13,19}", digits):
        raise api_error("Enter a valid card number.", "cardNumber")

    today = date.today()
    last_day_of_expiry_month = (
        date(payload.exp_year + (payload.exp_month // 12), (payload.exp_month % 12) + 1, 1) - timedelta(days=1)
    )
    if not (1 <= payload.exp_month <= 12) or last_day_of_expiry_month < today:
        raise api_error("Enter a valid expiry date.", "expiry")
    if not re.fullmatch(r"\d{3,4}", payload.cvc):
        raise api_error("Enter a valid security code.", "cvc")
    holder_name = payload.holder_name.strip()
    if len(holder_name) < 1:
        raise api_error("Enter the name on the card.", "holderName")

    existing = db.get(PaymentMethod, current_user.organization_id)
    if existing:
        db.delete(existing)
        db.flush()

    method = PaymentMethod(
        organization_id=current_user.organization_id,
        brand=_detect_brand(digits),
        last4=digits[-4:],
        exp_month=payload.exp_month,
        exp_year=payload.exp_year,
        holder_name=holder_name,
    )
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@router.delete("/payment-method", status_code=204)
def remove_payment_method(current_user: CurrentUser, db: DbSession) -> None:
    method = db.get(PaymentMethod, current_user.organization_id)
    if method:
        db.delete(method)
        db.commit()
