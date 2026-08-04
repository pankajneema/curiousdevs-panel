from app.schemas.base import CamelModel


class UpdateProfileIn(CamelModel):
    name: str
    username: str
    phone: str
    job_title: str
    department: str
    bio: str
    timezone: str
    language: str


class UpdateAvatarIn(CamelModel):
    avatar_url: str | None


class ChangePasswordIn(CamelModel):
    current_password: str
    new_password: str
