from app.schemas.base import CamelModel


class UpdateOrganizationIn(CamelModel):
    name: str
    domain: str


class DomainVerificationOut(CamelModel):
    domain: str
    domain_verified: bool
    record_name: str
    record_value: str


class RevokeAllAgentsOut(CamelModel):
    revoked_count: int


class DeleteOrganizationIn(CamelModel):
    confirm_name: str
