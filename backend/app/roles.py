"""Mirrors the frontend's lib/roles.ts -- the built-in role table is a fixed
business rule, not data, so it lives in code on both sides rather than in the
database."""

PERMISSIONS: list[dict[str, str]] = [
    {"key": "agents.view", "label": "View agents", "group": "Agents"},
    {"key": "agents.manage", "label": "Manage agents", "group": "Agents"},
    {"key": "policies.view", "label": "View policies", "group": "Policies"},
    {"key": "policies.manage", "label": "Manage policies", "group": "Policies"},
    {"key": "approvals.view", "label": "View approvals", "group": "Approvals"},
    {"key": "approvals.decide", "label": "Approve or deny requests", "group": "Approvals"},
    {"key": "evidence.view", "label": "View evidence", "group": "Evidence"},
    {"key": "evidence.export", "label": "Export evidence", "group": "Evidence"},
    {"key": "team.manage", "label": "Manage team & roles", "group": "Team"},
    {"key": "billing.manage", "label": "Manage billing", "group": "Billing"},
    {"key": "settings.manage", "label": "Manage organization settings", "group": "Settings"},
]

_ALL_PERMISSIONS = [p["key"] for p in PERMISSIONS]

BUILT_IN_ROLES: list[dict] = [
    {
        "id": "owner",
        "name": "Owner",
        "description": "Full access, including billing and deleting the organization.",
        "permissions": _ALL_PERMISSIONS,
    },
    {
        "id": "security_admin",
        "name": "Security admin",
        "description": "Manages agents, policies, evidence and approvals.",
        "permissions": [
            "agents.view",
            "agents.manage",
            "policies.view",
            "policies.manage",
            "approvals.view",
            "approvals.decide",
            "evidence.view",
            "evidence.export",
        ],
    },
    {
        "id": "approver",
        "name": "Approver",
        "description": "Reviews and decides escalated requests.",
        "permissions": ["agents.view", "approvals.view", "approvals.decide", "evidence.view"],
    },
    {
        "id": "viewer",
        "name": "Viewer",
        "description": "Read-only access across the console.",
        "permissions": ["agents.view", "policies.view", "approvals.view", "evidence.view"],
    },
]

BUILT_IN_ROLE_IDS = {r["id"] for r in BUILT_IN_ROLES}


def is_built_in_role(role_id: str) -> bool:
    return role_id in BUILT_IN_ROLE_IDS
