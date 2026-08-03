from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    agents,
    api_keys,
    auth,
    billing,
    groups,
    integrations,
    notifications,
    profile,
    roles,
    security,
    team,
    webhooks,
)

app = FastAPI(title="AgentGuard Console API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(team.router)
app.include_router(roles.router)
app.include_router(groups.router)
app.include_router(agents.router)
app.include_router(api_keys.router)
app.include_router(webhooks.router)
app.include_router(integrations.router)
app.include_router(billing.router)
app.include_router(security.router)
app.include_router(notifications.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
