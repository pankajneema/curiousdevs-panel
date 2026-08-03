# backend

The API behind the AgentGuard **console** — accounts, teams, roles, groups,
billing, security (2FA/passkeys/recovery codes), API keys, webhooks,
integrations, and notification preferences. The frontend (`frontend/`) talks
to this service for all of that; nothing in the console is backed by
localStorage or mock data anymore.

Stack: FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic, managed with `uv`.

## Scope (expanded from the original plan)

This backend originally described itself as a narrow, read-only reader of
the AgentGuard decision log. That plan hasn't shipped yet. In the meantime
the console needed a real backend to replace its mock data layer, and rather
than stand up a second service, this one's scope grew to cover the console's
own domain: **organizations, users, team/role/group management, billing and
payment methods, security (2FA/passkeys/recovery codes/login history), API
keys, webhooks, integrations, and notification preferences.**

The original decision-log-reader scope below is still the plan for AgentGuard
itself — it just hasn't been built here yet. When it is, keep the same rule
that motivated the original split:

**The decision engine does not belong here.** That lives in the `agentguard`
repo and runs on the customer's execution path. This service is a *reader* of
what the engine produced, plus control-plane workflows around it. If a
request from this service can change a verdict in flight, something has gone
wrong.

## What's implemented today

- `app/routers/auth.py` — register, login (2-step when 2FA is enabled:
  `POST /auth/login` → `POST /auth/login/verify-2fa`), `GET /auth/me`.
- `app/routers/profile.py` — profile fields, avatar, password change.
- `app/routers/team.py` — members, invitations, role assignment, removal.
- `app/routers/roles.py` — built-in roles (defined in code, `app/roles.py`,
  mirrored from `frontend/src/lib/roles.ts`) + custom roles (real table).
- `app/routers/groups.py` — groups and membership (many-to-many).
- `app/routers/agents.py` — agent inventory, seeded per organization.
- `app/routers/api_keys.py` — API key issuance (secret shown once), status,
  revocation, expiry.
- `app/routers/webhooks.py` — webhook endpoints and event subscriptions.
- `app/routers/integrations.py` — connected integrations.
- `app/routers/billing.py` — plan, seats, payment method.
- `app/routers/security.py` — TOTP 2FA (`pyotp`), recovery codes, passkeys,
  login event history.
- `app/routers/notifications.py` — per-user notification preferences.

Every table that holds tenant data carries an `organization_id` and every
router filters by `current_user.organization_id` — no cross-tenant reads.

Auth is stateless JWT (`app/security.py`, `app/deps.py`): a bearer token
carries the user id and a `kind` claim (`access` vs. `pending_2fa`), verified
per-request via `get_current_user`. Passwords and recovery codes are hashed
with `bcrypt` directly (not `passlib`, to sidestep the passlib/bcrypt≥4.1
compatibility issue).

Response models are `CamelModel` (`app/schemas/base.py`) — Pydantic classes
with `alias_generator=to_camel`, so the wire format is camelCase and matches
the frontend's TypeScript types field-for-field.

## Running it

```
uv run alembic upgrade head     # apply migrations to $DATABASE_URL
uv run uvicorn app.main:app --reload --port 8000
```

Configuration is read from `.env` (see `app/config.py`): `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGINS`, token expiry settings.

## Contracts (future AgentGuard scope, not yet built)

The API shapes for the decision-log reader are fixed in the LLD (§12).
`CallContext` and `DecisionRecord` are defined in Protobuf and must not be
redefined here — generate from the shared schema.
