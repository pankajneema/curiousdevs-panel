from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import CustomRole, Invitation, User
from app.roles import BUILT_IN_ROLES, is_built_in_role
from app.schemas.role import CreateRoleIn, CustomRoleOut, RolesOut

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=RolesOut)
def list_roles(current_user: CurrentUser, db: DbSession) -> RolesOut:
    custom = db.scalars(select(CustomRole).where(CustomRole.organization_id == current_user.organization_id)).all()
    return RolesOut(built_in=BUILT_IN_ROLES, custom=list(custom))


@router.post("", response_model=CustomRoleOut)
def create_role(payload: CreateRoleIn, current_user: CurrentUser, db: DbSession) -> CustomRoleOut:
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this role.", "name")
    if is_built_in_role(name.lower()):
        raise api_error("That name is reserved for a built-in role.", "name")

    role = CustomRole(organization_id=current_user.organization_id, name=name, permissions=payload.permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=204)
def delete_role(role_id: str, current_user: CurrentUser, db: DbSession) -> None:
    role = db.get(CustomRole, role_id)
    if not role or role.organization_id != current_user.organization_id:
        return

    # Anyone holding this role falls back to viewer -- never orphaned.
    db.query(User).filter(User.organization_id == current_user.organization_id, User.role == role_id).update(
        {"role": "viewer"}
    )
    db.query(Invitation).filter(
        Invitation.organization_id == current_user.organization_id, Invitation.role == role_id
    ).update({"role": "viewer"})

    db.delete(role)
    db.commit()
