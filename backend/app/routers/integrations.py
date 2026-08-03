from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.models import Integration
from app.schemas.integration import ConnectIntegrationIn, IntegrationOut

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationOut])
def list_integrations(current_user: CurrentUser, db: DbSession) -> list[IntegrationOut]:
    return list(
        db.scalars(select(Integration).where(Integration.organization_id == current_user.organization_id)).all()
    )


@router.post("", response_model=IntegrationOut)
def connect_integration(payload: ConnectIntegrationIn, current_user: CurrentUser, db: DbSession) -> IntegrationOut:
    if len(payload.label.strip()) < 1:
        raise api_error("This field is required.", "label")

    existing = db.scalar(
        select(Integration).where(
            Integration.organization_id == current_user.organization_id, Integration.kind == payload.kind
        )
    )
    if existing:
        existing.label = payload.label.strip()
        db.commit()
        db.refresh(existing)
        return existing

    integration = Integration(organization_id=current_user.organization_id, kind=payload.kind, label=payload.label.strip())
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


@router.delete("/{integration_id}", status_code=204)
def disconnect_integration(integration_id: str, current_user: CurrentUser, db: DbSession) -> None:
    integration = db.get(Integration, integration_id)
    if integration and integration.organization_id == current_user.organization_id:
        db.delete(integration)
        db.commit()
