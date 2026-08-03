from datetime import datetime

from app.schemas.base import CamelModel


class OrganizationOut(CamelModel):
    id: str
    name: str
    domain: str
    domain_verified: bool
    data_residency: str
    created_at: datetime


class UserOut(CamelModel):
    id: str
    name: str
    username: str
    email: str
    phone: str | None
    job_title: str | None
    department: str | None
    bio: str | None
    role: str
    avatar_url: str | None
    timezone: str
    language: str
    created_at: datetime
    last_active_at: datetime | None


class SessionOut(CamelModel):
    token: str
    user: UserOut
    organization: OrganizationOut
    expires_at: datetime
