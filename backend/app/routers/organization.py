import secrets

from fastapi import APIRouter
from sqlalchemy import update

from app.audit import record
from app.deps import CurrentUser, DbSession
from app.domain_check import check_domain_txt_record, is_valid_domain, verification_record_name
from app.errors import api_error
from app.models import Agent, Organization
from app.routers.auth import _issue_session
from app.schemas.common import SessionOut
from app.schemas.organization import (
    DeleteOrganizationIn,
    DomainVerificationOut,
    RevokeAllAgentsOut,
    UpdateOrganizationIn,
)

router = APIRouter(prefix="/organization", tags=["organization"])


def _require_owner(current_user: CurrentUser) -> None:
    if current_user.role != "owner":
        raise api_error("Only the owner can do this.", status_code=403)


@router.patch("", response_model=SessionOut)
def update_organization(payload: UpdateOrganizationIn, current_user: CurrentUser, db: DbSession) -> SessionOut:
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Enter an organization name.", "name")
    domain = payload.domain.strip().lower()
    if not is_valid_domain(domain):
        raise api_error("Enter a valid domain, like example.com.", "domain")

    org = db.get(Organization, current_user.organization_id)
    org.name = name
    if domain != org.domain:
        # Changing the domain means whatever ownership was proven for the
        # old one no longer applies — start over with a fresh token.
        org.domain = domain
        org.domain_verified = False
        org.domain_verify_token = secrets.token_hex(12)
    record(db, current_user, "organization.updated", "organization", org.id, org.name, f"Updated organization settings for “{org.name}”")
    db.commit()
    db.refresh(current_user)
    return _issue_session(db, current_user)


@router.get("/domain-verification", response_model=DomainVerificationOut)
def get_domain_verification(current_user: CurrentUser, db: DbSession) -> DomainVerificationOut:
    org = db.get(Organization, current_user.organization_id)
    if not org.domain_verify_token:
        org.domain_verify_token = secrets.token_hex(12)
        db.commit()
    return DomainVerificationOut(
        domain=org.domain,
        domain_verified=org.domain_verified,
        record_name=verification_record_name(org.domain),
        record_value=org.domain_verify_token,
    )


@router.post("/domain-verification/verify", response_model=DomainVerificationOut)
def verify_domain(current_user: CurrentUser, db: DbSession) -> DomainVerificationOut:
    org = db.get(Organization, current_user.organization_id)
    if not org.domain_verify_token:
        raise api_error("Nothing to verify yet.")
    if check_domain_txt_record(org.domain, org.domain_verify_token):
        org.domain_verified = True
        record(db, current_user, "organization.domain_verified", "organization", org.id, org.domain, f"Verified domain ownership of {org.domain}")
        db.commit()
    else:
        raise api_error(
            f"Couldn't find that TXT record on {org.domain} yet. DNS changes can take a few minutes to propagate."
        )
    return DomainVerificationOut(
        domain=org.domain,
        domain_verified=org.domain_verified,
        record_name=verification_record_name(org.domain),
        record_value=org.domain_verify_token,
    )


@router.post("/revoke-all-agents", response_model=RevokeAllAgentsOut)
def revoke_all_agents(current_user: CurrentUser, db: DbSession) -> RevokeAllAgentsOut:
    _require_owner(current_user)
    result = db.execute(
        update(Agent)
        .where(Agent.organization_id == current_user.organization_id, Agent.status != "quarantined")
        .values(status="quarantined")
    )
    record(
        db, current_user, "organization.agents_revoked", "organization", current_user.organization_id, "all agents",
        f"Quarantined {result.rowcount} agent(s) via Revoke all",
    )
    db.commit()
    return RevokeAllAgentsOut(revoked_count=result.rowcount)


@router.delete("", status_code=204)
def delete_organization(payload: DeleteOrganizationIn, current_user: CurrentUser, db: DbSession) -> None:
    _require_owner(current_user)
    org = db.get(Organization, current_user.organization_id)
    if payload.confirm_name.strip() != org.name:
        raise api_error("Type the organization name exactly to confirm.", "confirmName")
    db.delete(org)  # cascades: users, agents, groups, billing, everything scoped to this org
    db.commit()
