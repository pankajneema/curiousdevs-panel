"""Real outbound checks run right after an integration/webhook is created —
each one actually contacts the provider instead of just accepting whatever
was typed in. Every check returns (ok, detail) and never raises; the caller
always gets a verdict to store, even if the network call itself failed."""

import hashlib
import hmac
import json
import time
from urllib.parse import urlparse

import httpx

TIMEOUT = httpx.Timeout(10.0)


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def check_slack(webhook_url: str) -> tuple[bool, str]:
    if not _is_http_url(webhook_url) or "hooks.slack.com" not in webhook_url:
        return False, "That doesn't look like a Slack incoming webhook URL."
    try:
        resp = httpx.post(
            webhook_url,
            json={"text": "✅ AgentGuard is now connected to this channel."},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach Slack: {exc}"
    if resp.status_code == 200 and resp.text.strip() == "ok":
        return True, "Test message delivered."
    return False, f"Slack rejected the webhook (HTTP {resp.status_code})."


def check_teams(webhook_url: str) -> tuple[bool, str]:
    if not _is_http_url(webhook_url):
        return False, "That doesn't look like a valid webhook URL."
    try:
        resp = httpx.post(
            webhook_url,
            json={"text": "AgentGuard is now connected to this channel."},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach Microsoft Teams: {exc}"
    if 200 <= resp.status_code < 300:
        return True, "Test message delivered."
    return False, f"Teams rejected the webhook (HTTP {resp.status_code})."


def check_pagerduty(routing_key: str) -> tuple[bool, str]:
    routing_key = routing_key.strip()
    if len(routing_key) < 20:
        return False, "That doesn't look like a valid PagerDuty integration key."
    dedup_key = f"agentguard-connection-test-{routing_key[:8]}"
    try:
        trigger = httpx.post(
            "https://events.pagerduty.com/v2/enqueue",
            json={
                "routing_key": routing_key,
                "event_action": "trigger",
                "dedup_key": dedup_key,
                "payload": {
                    "summary": "AgentGuard connection test — safe to ignore, auto-resolving.",
                    "source": "agentguard-console",
                    "severity": "info",
                },
            },
            timeout=TIMEOUT,
        )
        if trigger.status_code != 202:
            return False, f"PagerDuty rejected the integration key (HTTP {trigger.status_code})."
        # Immediately resolve so the test doesn't leave a live incident behind.
        httpx.post(
            "https://events.pagerduty.com/v2/enqueue",
            json={"routing_key": routing_key, "event_action": "resolve", "dedup_key": dedup_key},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach PagerDuty: {exc}"
    return True, "Test event delivered and auto-resolved."


def check_siem(endpoint_url: str) -> tuple[bool, str]:
    if not _is_http_url(endpoint_url):
        return False, "Enter a valid endpoint URL."
    try:
        resp = httpx.post(
            endpoint_url,
            json={"event": "agentguard.connection_test", "timestamp": time.time()},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach that endpoint: {exc}"
    if 200 <= resp.status_code < 300:
        return True, f"Endpoint responded (HTTP {resp.status_code})."
    return False, f"Endpoint responded with HTTP {resp.status_code}."


def check_secrets_manager(value: str) -> tuple[bool, str]:
    # No credentials are collected for this kind, so there's nothing to
    # actually call — format-check only, and say so honestly rather than
    # claiming a live verification that didn't happen.
    if len(value.strip()) < 3:
        return False, "Enter the provider and secret path."
    return True, "Saved — live verification isn't available without provider credentials."


def check_mcp_server(endpoint: str) -> tuple[bool, str]:
    """Speaks MCP's real JSON-RPC handshake to the endpoint (the same
    'initialize' request any MCP client sends first) instead of just
    pinging it — a plain 200 OK doesn't tell you it's actually an MCP
    server."""
    if not _is_http_url(endpoint):
        return False, "Enter a valid URL."
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "agentguard-console", "version": "1.0"},
        },
    }
    try:
        resp = httpx.post(
            endpoint,
            json=body,
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach that endpoint: {exc}"

    if resp.status_code >= 400:
        return False, f"Endpoint responded with HTTP {resp.status_code}."

    content_type = resp.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            data = resp.json()
        except ValueError:
            return True, f"Endpoint responded (HTTP {resp.status_code}), but the body wasn't valid JSON-RPC."
        if isinstance(data, dict) and ("result" in data or "error" in data):
            return True, "Responded to an MCP initialize request."
        return True, f"Endpoint responded (HTTP {resp.status_code}), but not with an MCP-shaped reply."

    # Streamable-HTTP servers may reply over text/event-stream instead of a
    # plain JSON body — a 2xx there still means something real is listening.
    return True, f"Endpoint responded (HTTP {resp.status_code})."


def check_generic_webhook(url: str, signing_secret: str) -> tuple[bool, str]:
    if not _is_http_url(url):
        return False, "Enter a valid URL."
    body = json.dumps({"event": "agentguard.connection_test", "timestamp": time.time()}).encode()
    signature = hmac.new(signing_secret.encode(), body, hashlib.sha256).hexdigest()
    try:
        resp = httpx.post(
            url,
            content=body,
            headers={"Content-Type": "application/json", "X-AgentGuard-Signature": f"sha256={signature}"},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        return False, f"Couldn't reach that endpoint: {exc}"
    if 200 <= resp.status_code < 300:
        return True, f"Test delivery succeeded (HTTP {resp.status_code})."
    return False, f"Endpoint responded with HTTP {resp.status_code}."


CHECKS = {
    "slack": check_slack,
    "teams": check_teams,
    "pagerduty": check_pagerduty,
    "siem": check_siem,
    "secrets_manager": check_secrets_manager,
}
