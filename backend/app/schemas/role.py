from datetime import datetime

from app.schemas.base import CamelModel


class BuiltInRoleOut(CamelModel):
    id: str
    name: str
    description: str
    permissions: list[str]


class CustomRoleOut(CamelModel):
    id: str
    organization_id: str
    name: str
    permissions: list[str]
    created_at: datetime


class RolesOut(CamelModel):
    built_in: list[BuiltInRoleOut]
    custom: list[CustomRoleOut]


class CreateRoleIn(CamelModel):
    name: str
    permissions: list[str]
