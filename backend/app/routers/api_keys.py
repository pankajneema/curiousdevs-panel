from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import ApiKey
from app.schemas.api_key import ApiKeyOut, CreateApiKeyIn, CreatedApiKeyOut, UpdateApiKeyStatusIn
from app.security import generate_api_secret

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyOut])
def list_api_keys(current_user: CurrentUser, db: DbSession) -> list[ApiKeyOut]:
    return list(
        db.scalars(select(ApiKey).where(ApiKey.organization_id == current_user.organization_id)).all()
    )


@router.post("", response_model=CreatedApiKeyOut)
def create_api_key(payload: CreateApiKeyIn, current_user: CurrentUser, db: DbSession) -> CreatedApiKeyOut:
    if len(payload.name.strip()) < 1:
        raise api_error("Name this key so you can find it later.", "name")

    secret, prefix, secret_hash = generate_api_secret()
    key = ApiKey(
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        name=payload.name.strip(),
        prefix=prefix,
        secret_hash=secret_hash,
        expires_at=payload.expires_at,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return CreatedApiKeyOut(key=ApiKeyOut.model_validate(key), secret=secret)


@router.patch("/{key_id}/status", status_code=204)
def update_api_key_status(key_id: str, payload: UpdateApiKeyStatusIn, current_user: CurrentUser, db: DbSession) -> None:
    key = db.get(ApiKey, key_id)
    if key and key.organization_id == current_user.organization_id:
        key.status = payload.status
        db.commit()


@router.delete("/{key_id}", status_code=204)
def revoke_api_key(key_id: str, current_user: CurrentUser, db: DbSession) -> None:
    key = db.get(ApiKey, key_id)
    if key and key.organization_id == current_user.organization_id:
        db.delete(key)
        db.commit()
