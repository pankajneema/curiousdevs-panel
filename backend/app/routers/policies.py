from fastapi import APIRouter
from sqlalchemy import func, select

from app.audit import record
from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import Policy
from app.models.policy import agent_policies
from app.schemas.policy import CreatePolicyIn, PolicyOut, UpdatePolicyIn

router = APIRouter(prefix="/policies", tags=["policies"])

STATUSES = {"draft", "active"}


def policy_to_out(db: DbSession, policy: Policy) -> PolicyOut:
    count = (
        db.scalar(select(func.count()).select_from(agent_policies).where(agent_policies.c.policy_id == policy.id))
        or 0
    )
    return PolicyOut(
        id=policy.id,
        organization_id=policy.organization_id,
        name=policy.name,
        description=policy.description,
        status=policy.status,
        attached_agent_count=count,
        created_at=policy.created_at,
    )


@router.get("", response_model=list[PolicyOut])
def list_policies(current_user: CurrentUser, db: DbSession) -> list[PolicyOut]:
    policies = db.scalars(select(Policy).where(Policy.organization_id == current_user.organization_id)).all()
    return [policy_to_out(db, p) for p in policies]


@router.post("", response_model=PolicyOut)
def create_policy(payload: CreatePolicyIn, current_user: CurrentUser, db: DbSession) -> PolicyOut:
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this policy.", "name")
    if payload.status not in STATUSES:
        raise api_error("Choose a valid status.", "status")

    policy = Policy(
        organization_id=current_user.organization_id,
        name=name,
        description=payload.description.strip(),
        status=payload.status,
    )
    db.add(policy)
    db.flush()  # assigns policy.id so the audit entry below can reference it
    record(db, current_user, "policy.created", "policy", policy.id, name, f"Created policy “{name}”")
    db.commit()
    db.refresh(policy)
    return policy_to_out(db, policy)


@router.patch("/{policy_id}", response_model=PolicyOut)
def update_policy(policy_id: str, payload: UpdatePolicyIn, current_user: CurrentUser, db: DbSession) -> PolicyOut:
    policy = db.get(Policy, policy_id)
    if not policy or policy.organization_id != current_user.organization_id:
        raise api_error("Policy not found.")

    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this policy.", "name")
    if payload.status not in STATUSES:
        raise api_error("Choose a valid status.", "status")

    policy.name = name
    policy.description = payload.description.strip()
    policy.status = payload.status
    record(db, current_user, "policy.updated", "policy", policy.id, name, f"Updated policy “{name}”")
    db.commit()
    db.refresh(policy)
    return policy_to_out(db, policy)


@router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: str, current_user: CurrentUser, db: DbSession) -> None:
    policy = db.get(Policy, policy_id)
    if policy and policy.organization_id == current_user.organization_id:
        record(db, current_user, "policy.deleted", "policy", policy.id, policy.name, f"Deleted policy “{policy.name}”")
        db.delete(policy)
        db.commit()
