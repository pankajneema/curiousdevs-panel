from app.schemas.base import CamelModel
from app.schemas.common import SessionOut


class RegisterIn(CamelModel):
    name: str
    username: str
    email: str
    password: str
    organization_name: str
    data_residency: str = "in"


class LoginIn(CamelModel):
    email: str
    password: str


class LoginResult(CamelModel):
    requires_two_factor: bool
    pending_token: str | None = None
    session: SessionOut | None = None


class VerifyTwoFactorIn(CamelModel):
    pending_token: str
    code: str
