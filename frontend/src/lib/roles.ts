import type { CustomRole, Permission, Role, RoleId } from "./types";

export const PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "agents.view", label: "View agents", group: "Agents" },
  { key: "agents.manage", label: "Manage agents", group: "Agents" },
  { key: "policies.view", label: "View policies", group: "Policies" },
  { key: "policies.manage", label: "Manage policies", group: "Policies" },
  { key: "approvals.view", label: "View approvals", group: "Approvals" },
  { key: "approvals.decide", label: "Approve or deny requests", group: "Approvals" },
  { key: "evidence.view", label: "View evidence", group: "Evidence" },
  { key: "evidence.export", label: "Export evidence", group: "Evidence" },
  { key: "team.manage", label: "Manage team & roles", group: "Team" },
  { key: "billing.manage", label: "Manage billing", group: "Billing" },
  { key: "settings.manage", label: "Manage organization settings", group: "Settings" },
];

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

export const BUILT_IN_ROLES: {
  id: Role;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access, including billing and deleting the organization.",
    permissions: ALL_PERMISSIONS,
  },
  {
    id: "security_admin",
    name: "Security admin",
    description: "Manages agents, policies, evidence and approvals.",
    permissions: [
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
    id: "approver",
    name: "Approver",
    description: "Reviews and decides escalated requests.",
    permissions: ["agents.view", "approvals.view", "approvals.decide", "evidence.view"],
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access across the console.",
    permissions: ["agents.view", "policies.view", "approvals.view", "evidence.view"],
  },
];

export function isBuiltInRole(id: RoleId): id is Role {
  return BUILT_IN_ROLES.some((r) => r.id === id);
}

export function resolveRoleName(id: RoleId, customRoles: CustomRole[]): string {
  const builtIn = BUILT_IN_ROLES.find((r) => r.id === id);
  if (builtIn) return builtIn.name;
  const custom = customRoles.find((r) => r.id === id);
  return custom?.name ?? "Unknown role";
}

export function resolveRolePermissions(id: RoleId, customRoles: CustomRole[]): Permission[] {
  const builtIn = BUILT_IN_ROLES.find((r) => r.id === id);
  if (builtIn) return builtIn.permissions;
  const custom = customRoles.find((r) => r.id === id);
  return custom?.permissions ?? [];
}
