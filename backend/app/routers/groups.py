from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import Group, User
from app.schemas.group import CreateGroupIn, GroupOut, UpdateGroupMembersIn

router = APIRouter(prefix="/groups", tags=["groups"])


def _to_out(group: Group) -> GroupOut:
    return GroupOut(
        id=group.id,
        organization_id=group.organization_id,
        name=group.name,
        member_user_ids=[m.id for m in group.members],
        created_at=group.created_at,
    )


@router.get("", response_model=list[GroupOut])
def list_groups(current_user: CurrentUser, db: DbSession) -> list[GroupOut]:
    groups = db.scalars(select(Group).where(Group.organization_id == current_user.organization_id)).all()
    return [_to_out(g) for g in groups]


@router.post("", response_model=GroupOut)
def create_group(payload: CreateGroupIn, current_user: CurrentUser, db: DbSession) -> GroupOut:
    name = payload.name.strip()
    if len(name) < 1:
        raise api_error("Name this group.", "name")

    group = Group(organization_id=current_user.organization_id, name=name)
    # The owner has access to everything anyway -- default them into every
    # new group rather than starting empty with no obvious way in.
    owner = db.scalar(
        select(User).where(User.organization_id == current_user.organization_id, User.role == "owner")
    )
    if owner:
        group.members.append(owner)
    db.add(group)
    db.commit()
    db.refresh(group)
    return _to_out(group)


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, current_user: CurrentUser, db: DbSession) -> None:
    group = db.get(Group, group_id)
    if group and group.organization_id == current_user.organization_id:
        db.delete(group)
        db.commit()


@router.put("/{group_id}/members", response_model=GroupOut)
def update_group_members(group_id: str, payload: UpdateGroupMembersIn, current_user: CurrentUser, db: DbSession) -> GroupOut:
    group = db.get(Group, group_id)
    if not group or group.organization_id != current_user.organization_id:
        raise api_error("Group not found.")

    members = db.scalars(
        select(User).where(User.id.in_(payload.member_user_ids), User.organization_id == current_user.organization_id)
    ).all()
    group.members = list(members)
    db.commit()
    db.refresh(group)
    return _to_out(group)
