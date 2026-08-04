import json
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import func, select
from starlette.concurrency import run_in_threadpool

from app.audit import record
from app.db import SessionLocal
from app.deps import CurrentUser, DbSession
from app.errors import api_error
from app.events import publish
from app.integration_checks import check_mcp_server
from app.models import McpServer
from app.models.mcp_server import agent_mcp_servers
from app.schemas.mcp_server import CreateMcpServerIn, ImportMcpServersIn, McpServerOut, UpdateMcpServerIn

router = APIRouter(prefix="/mcp-servers", tags=["mcp-servers"])

TRANSPORTS = {"http", "stdio"}


def mcp_server_to_out(db: DbSession, server: McpServer) -> McpServerOut:
    count = (
        db.scalar(
            select(func.count()).select_from(agent_mcp_servers).where(agent_mcp_servers.c.mcp_server_id == server.id)
        )
        or 0
    )
    return McpServerOut(
        id=server.id,
        name=server.name,
        transport=server.transport,
        endpoint=server.endpoint,
        command=server.command,
        args=server.args,
        description=server.description,
        status=server.status,
        status_detail=server.status_detail,
        checked_at=server.checked_at,
        created_at=server.created_at,
        used_by_agent_count=count,
    )


def find_or_create_mcp_server(
    db: DbSession, organization_id: str, name: str, entry: dict[str, Any]
) -> tuple[McpServer, bool] | None:
    """Matches an mcpServers config entry against an existing row by value
    (same endpoint, or same command+args) before creating a new one — so
    reporting in the same config twice (a redeploy, a periodic heartbeat)
    doesn't pile up duplicate registry entries. Returns (server, was_created)."""
    if isinstance(entry.get("url"), str):
        endpoint = entry["url"]
        existing = db.scalar(
            select(McpServer).where(
                McpServer.organization_id == organization_id, McpServer.transport == "http", McpServer.endpoint == endpoint
            )
        )
        if existing:
            return existing, False
        server = McpServer(
            organization_id=organization_id, name=name or "untitled", transport="http", endpoint=endpoint, status="pending"
        )
        db.add(server)
        db.flush()
        return server, True

    if isinstance(entry.get("command"), str):
        command = entry["command"]
        raw_args = entry.get("args")
        args = [str(a) for a in raw_args] if isinstance(raw_args, list) else []
        candidates = db.scalars(
            select(McpServer).where(
                McpServer.organization_id == organization_id, McpServer.transport == "stdio", McpServer.command == command
            )
        ).all()
        existing = next((s for s in candidates if s.args == args), None)
        if existing:
            return existing, False
        server = McpServer(
            organization_id=organization_id, name=name or "untitled", transport="stdio", command=command, args=args, status="local"
        )
        db.add(server)
        db.flush()
        return server, True

    return None


def _verify_mcp_server_blocking(server_id: str) -> tuple[str, str] | None:
    """Runs the real MCP handshake in a worker thread, never on the event
    loop, since it's a live network call to a customer-controlled endpoint."""
    db = SessionLocal()
    try:
        server = db.get(McpServer, server_id)
        if server is None or server.transport != "http" or not server.endpoint:
            return None
        ok, detail = check_mcp_server(server.endpoint)
        server.status = "reachable" if ok else "unreachable"
        server.status_detail = detail
        server.checked_at = datetime.now(UTC)
        db.commit()
        return server.id, server.status
    finally:
        db.close()


async def _verify_mcp_server(server_id: str, organization_id: str) -> None:
    result = await run_in_threadpool(_verify_mcp_server_blocking, server_id)
    if result is None:
        return
    verified_id, status = result
    publish(organization_id, {"type": "mcp_server.status", "mcpServerId": verified_id, "status": status})


def _validate_and_apply(server: McpServer, name: str, transport: str, endpoint: str | None, command: str | None, args: list[str], description: str) -> None:
    if len(name) < 1:
        raise api_error("Name this server.", "name")
    if transport not in TRANSPORTS:
        raise api_error("Choose a valid transport.", "transport")

    if transport == "http":
        parsed = urlparse((endpoint or "").strip())
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise api_error("Enter a valid URL.", "endpoint")
        server.endpoint = endpoint.strip() if endpoint else None
        server.command = None
        server.args = []
    else:
        command = (command or "").strip()
        if len(command) < 1:
            raise api_error("Enter the command this server is launched with.", "command")
        server.endpoint = None
        server.command = command
        server.args = [a for a in args if a.strip()]

    server.name = name
    server.transport = transport
    server.description = description.strip()


@router.get("", response_model=list[McpServerOut])
def list_mcp_servers(current_user: CurrentUser, db: DbSession) -> list[McpServerOut]:
    servers = db.scalars(select(McpServer).where(McpServer.organization_id == current_user.organization_id)).all()
    return [mcp_server_to_out(db, s) for s in servers]


@router.post("", response_model=McpServerOut)
def create_mcp_server(
    payload: CreateMcpServerIn, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> McpServerOut:
    server = McpServer(organization_id=current_user.organization_id)
    _validate_and_apply(
        server, payload.name.strip(), payload.transport, payload.endpoint, payload.command, payload.args, payload.description
    )
    server.status = "pending" if server.transport == "http" else "local"

    db.add(server)
    db.flush()  # assigns server.id so the audit entry below can reference it
    record(db, current_user, "mcp_server.created", "mcp_server", server.id, server.name, f"Registered MCP server “{server.name}”")
    db.commit()
    db.refresh(server)

    if server.transport == "http":
        # Queued for after this response is sent — registering a server
        # returns immediately instead of waiting on the endpoint to respond.
        background_tasks.add_task(_verify_mcp_server, server.id, current_user.organization_id)

    return mcp_server_to_out(db, server)


@router.patch("/{server_id}", response_model=McpServerOut)
def update_mcp_server(
    server_id: str,
    payload: UpdateMcpServerIn,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> McpServerOut:
    server = db.get(McpServer, server_id)
    if not server or server.organization_id != current_user.organization_id:
        raise api_error("MCP server not found.")

    _validate_and_apply(
        server, payload.name.strip(), payload.transport, payload.endpoint, payload.command, payload.args, payload.description
    )
    server.status = "pending" if server.transport == "http" else "local"
    server.status_detail = None
    record(db, current_user, "mcp_server.updated", "mcp_server", server.id, server.name, f"Updated MCP server “{server.name}”")
    db.commit()
    db.refresh(server)

    if server.transport == "http":
        background_tasks.add_task(_verify_mcp_server, server.id, current_user.organization_id)

    return mcp_server_to_out(db, server)


@router.post("/{server_id}/verify", response_model=McpServerOut)
def reverify_mcp_server(
    server_id: str, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> McpServerOut:
    server = db.get(McpServer, server_id)
    if not server or server.organization_id != current_user.organization_id:
        raise api_error("MCP server not found.")
    if server.transport != "http":
        raise api_error("Local servers run on the agent's own host — there's nothing here to dial.", "transport")
    server.status = "pending"
    db.commit()
    db.refresh(server)
    background_tasks.add_task(_verify_mcp_server, server.id, current_user.organization_id)
    return mcp_server_to_out(db, server)


@router.post("/import", response_model=list[McpServerOut])
def import_mcp_servers(
    payload: ImportMcpServersIn, current_user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> list[McpServerOut]:
    """Accepts the same `{"mcpServers": {...}}` JSON shape used by Claude
    Desktop, Cursor, VS Code, and Windsurf, so an existing config can be
    pasted in wholesale instead of re-typing each server."""
    try:
        parsed = json.loads(payload.config)
    except json.JSONDecodeError:
        raise api_error("That's not valid JSON.", "config")

    entries = parsed.get("mcpServers") if isinstance(parsed, dict) else None
    if not isinstance(entries, dict) or len(entries) == 0:
        raise api_error('Expected an object with an "mcpServers" key containing at least one entry.', "config")

    result: list[McpServer] = []
    newly_created: list[McpServer] = []
    for name, entry in entries.items():
        if not isinstance(entry, dict):
            continue
        found = find_or_create_mcp_server(db, current_user.organization_id, str(name).strip(), entry)
        if found is None:
            continue
        server, was_created = found
        result.append(server)
        if was_created:
            newly_created.append(server)

    if len(result) == 0:
        raise api_error("No valid server entries found in that config.", "config")

    names = ", ".join(s.name for s in result)
    record(
        db,
        current_user,
        "mcp_server.imported",
        "mcp_server",
        None,
        f"{len(result)} server(s)",
        f"Imported {len(result)} MCP server(s) from JSON: {names}",
    )
    db.commit()
    for server in result:
        db.refresh(server)
    for server in newly_created:
        if server.transport == "http":
            background_tasks.add_task(_verify_mcp_server, server.id, current_user.organization_id)

    return [mcp_server_to_out(db, s) for s in result]


@router.delete("/{server_id}", status_code=204)
def delete_mcp_server(server_id: str, current_user: CurrentUser, db: DbSession) -> None:
    server = db.get(McpServer, server_id)
    if server and server.organization_id == current_user.organization_id:
        record(
            db, current_user, "mcp_server.deleted", "mcp_server", server.id, server.name, f"Deleted MCP server “{server.name}”"
        )
        db.delete(server)
        db.commit()
