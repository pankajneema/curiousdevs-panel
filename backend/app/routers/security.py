import pyotp
from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import LoginEvent, Passkey, RecoveryCode, TwoFactorCredential
from app.schemas.security import (
    AddPasskeyIn,
    ConfirmTwoFactorIn,
    LoginEventOut,
    PasskeyOut,
    SecuritySummaryOut,
    StartTwoFactorOut,
)
from app.security import generate_recovery_codes, hash_secret, verify_secret

router = APIRouter(prefix="/security", tags=["security"])


@router.get("/login-events", response_model=list[LoginEventOut])
def list_login_events(current_user: CurrentUser, db: DbSession) -> list[LoginEventOut]:
    events = db.scalars(
        select(LoginEvent).where(LoginEvent.user_id == current_user.id).order_by(LoginEvent.timestamp.desc())
    ).all()
    return list(events)


@router.get("/summary", response_model=SecuritySummaryOut)
def get_summary(current_user: CurrentUser, db: DbSession) -> SecuritySummaryOut:
    two_factor = db.get(TwoFactorCredential, current_user.id)
    count = len(
        db.scalars(
            select(RecoveryCode).where(RecoveryCode.user_id == current_user.id, RecoveryCode.used.is_(False))
        ).all()
    )
    passkeys = db.scalars(select(Passkey).where(Passkey.user_id == current_user.id)).all()
    return SecuritySummaryOut(
        two_factor_enabled=bool(two_factor and two_factor.enabled),
        recovery_code_count=count,
        passkeys=list(passkeys),
    )


@router.post("/2fa/start", response_model=StartTwoFactorOut)
def start_two_factor(current_user: CurrentUser, db: DbSession) -> StartTwoFactorOut:
    secret = pyotp.random_base32()
    credential = db.get(TwoFactorCredential, current_user.id)
    if credential:
        credential.secret = secret
        credential.enabled = False
    else:
        credential = TwoFactorCredential(user_id=current_user.id, secret=secret, enabled=False)
        db.add(credential)
    db.commit()
    return StartTwoFactorOut(secret=secret)


@router.post("/2fa/confirm", response_model=list[str])
def confirm_two_factor(payload: ConfirmTwoFactorIn, current_user: CurrentUser, db: DbSession) -> list[str]:
    credential = db.get(TwoFactorCredential, current_user.id)
    if not credential:
        raise api_error("Start two-factor setup first.")
    totp = pyotp.TOTP(credential.secret)
    if not totp.verify(payload.code, valid_window=1):
        raise api_error("That code didn't match. Try again.", "code")

    credential.enabled = True
    db.query(RecoveryCode).filter(RecoveryCode.user_id == current_user.id).delete()
    codes = generate_recovery_codes()
    db.add_all([RecoveryCode(user_id=current_user.id, code_hash=hash_secret(c)) for c in codes])
    db.commit()
    return codes


@router.post("/2fa/disable", status_code=204)
def disable_two_factor(current_user: CurrentUser, db: DbSession) -> None:
    db.query(TwoFactorCredential).filter(TwoFactorCredential.user_id == current_user.id).delete()
    db.query(RecoveryCode).filter(RecoveryCode.user_id == current_user.id).delete()
    db.commit()


@router.post("/recovery-codes/regenerate", response_model=list[str])
def regenerate_recovery_codes(current_user: CurrentUser, db: DbSession) -> list[str]:
    credential = db.get(TwoFactorCredential, current_user.id)
    if not credential or not credential.enabled:
        raise api_error("Turn on two-factor authentication first.")
    db.query(RecoveryCode).filter(RecoveryCode.user_id == current_user.id).delete()
    codes = generate_recovery_codes()
    db.add_all([RecoveryCode(user_id=current_user.id, code_hash=hash_secret(c)) for c in codes])
    db.commit()
    return codes


@router.post("/passkeys", response_model=PasskeyOut)
def add_passkey(payload: AddPasskeyIn, current_user: CurrentUser, db: DbSession) -> PasskeyOut:
    label = payload.label.strip()
    if len(label) < 1:
        raise api_error("Name this passkey so you can find it later.", "label")
    passkey = Passkey(user_id=current_user.id, label=label)
    db.add(passkey)
    db.commit()
    db.refresh(passkey)
    return passkey


@router.delete("/passkeys/{passkey_id}", status_code=204)
def remove_passkey(passkey_id: str, current_user: CurrentUser, db: DbSession) -> None:
    passkey = db.get(Passkey, passkey_id)
    if passkey and passkey.user_id == current_user.id:
        db.delete(passkey)
        db.commit()
