from datetime import datetime

from app.schemas.base import CamelModel


class LoginEventOut(CamelModel):
    id: str
    user_id: str
    timestamp: datetime
    user_agent: str


class PasskeyOut(CamelModel):
    id: str
    user_id: str
    label: str
    created_at: datetime


class SecuritySummaryOut(CamelModel):
    two_factor_enabled: bool
    recovery_code_count: int
    passkeys: list[PasskeyOut]


class StartTwoFactorOut(CamelModel):
    secret: str


class ConfirmTwoFactorIn(CamelModel):
    code: str


class AddPasskeyIn(CamelModel):
    label: str
