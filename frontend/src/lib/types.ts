/**
 * Canonical types for the AgentGuard console.
 *
 * `CallContext` and `DecisionRecord` mirror AgentGuard-LLD.md §3 field for
 * field (Protobuf → TypeScript). Those two are locked (LLD decision D6) —
 * do not rename or retype a field; add new fields as optional only.
 *
 * Everything below that (Agent, Rule/Policy, Tool, MCPServer, User, Org,
 * Approval request, ...) is not yet formalised in a schema document. It is
 * built from the prose descriptions in the Console UI Brief and is expected
 * to move under a real schema once the backend exists (backend/README.md:
 * "generate from the shared schema").
 *
 * Console UI Brief, Part 5: "Do not invent fields that are not in
 * lib/types.ts. If a screen needs data, the schema changes first." — this
 * file is that schema for now.
 */

// ─── §3.2 CallContext ──────────────────────────────────────────────────────

export type Environment = "DEV" | "STAGING" | "PROD";

export interface Principal {
  agentId: string;
  agentVersion: string; // sha256 of prompt + toolset + config
  spiffeId: string; // empty until MVP-2
  sessionId: string;
  onBehalfOf: string; // end user, if delegated; empty if not
  delegationChain: string[]; // RFC 8693 act chain, oldest first
}

export interface Action {
  toolName: string;
  toolVersion: string;
  toolDigest: string; // sha256 of the pinned tool definition
  arguments: Record<string, unknown>; // structured — never a string blob
  target: string; // resolved resource
  environment: Environment;
}

export interface SourceRef {
  callId: string; // which earlier call produced this
  label: string;
  digest: string;
}

export interface Provenance {
  taintLabels: string[]; // sorted, deduplicated
  sources: SourceRef[];
  planStep: number; // -1 when no plan was declared
  declaredIntent: string;
}

export interface Runtime {
  framework: "mcp" | "langchain" | "openai_agents" | "crewai" | "raw";
  model: string;
  callIndex: number; // nth mediated call this session
}

export interface CallContext {
  schemaVersion: number;
  callId: string; // UUIDv7 — time-ordered
  traceId: string; // one agent run
  parentCallId: string; // delegation/nesting; empty if root
  timestamp: string; // RFC3339 with nanoseconds
  principal: Principal;
  action: Action;
  provenance: Provenance;
  runtime: Runtime;
}

// ─── §3.3 DecisionRecord ───────────────────────────────────────────────────

export type Verdict = "ALLOW" | "BLOCK" | "REDACT" | "ESCALATE" | "SANDBOX";

export type Effect = "ALLOW" | "DENY" | "ESCALATE" | "REDACT" | "SANDBOX";

export interface MatchedRule {
  ruleId: string;
  policyVersion: string; // sha256 of the compiled bundle
  effect: Effect;
}

export interface Signal {
  detector: string;
  score: number;
  tier: 0 | 1 | 2 | 3;
  latencyUs: number;
}

export interface Mutation {
  /** What REDACT actually changed — present iff verdict === "REDACT". */
  fields: { path: string; before: unknown; after: unknown }[];
}

export interface Approval {
  approver: string;
  /** The EXACT bytes shown to the human — never the agent's own summary. */
  presented: string;
  presentedHash: string; // sha256 of `presented`
  decidedAt: string; // RFC3339
  latencyMs: number;
}

export type OutcomeStatus = "EXECUTED" | "REFUSED" | "ERRORED" | "TIMED_OUT";

export interface Outcome {
  status: OutcomeStatus;
  resultDigest: string; // sha256; the body is not stored by default
}

export interface Timing {
  totalUs: number;
  perStageUs: Record<string, number>;
}

export interface Chain {
  seq: number;
  prevHash: string;
  entryHash: string;
  signature: string; // empty until a signing key is configured
}

export interface DecisionRecord {
  schemaVersion: number;
  recordId: string;
  call: CallContext; // embedded in full
  verdict: Verdict;
  matchedRules: MatchedRule[];
  signals: Signal[];
  mutation: Mutation | null; // present iff verdict === "REDACT"
  approval: Approval | null; // present iff verdict === "ESCALATE"
  outcome: Outcome | null; // filled after execution
  timing: Timing;
  chain: Chain;
}

// ─── Identity & access (console-specific — not yet in the LLD) ────────────

export type Role = "owner" | "security_admin" | "approver" | "viewer";

/** A role id is either a built-in `Role` or a `CustomRole.id` — resolve
 * the display name and permission set with lib/roles.ts's helpers. */
export type RoleId = string;

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  role: RoleId;
  avatarUrl: string | null;
  timezone: string;
  language: string;
  createdAt: string;
  lastActiveAt: string | null;
}

export type DataResidency = "us" | "eu" | "in";

export interface Organization {
  id: string;
  name: string;
  domain: string;
  domainVerified: boolean;
  dataResidency: DataResidency;
  createdAt: string;
}

export interface Session {
  token: string;
  user: User;
  organization: Organization;
  expiresAt: string;
}

// ─── Team & invitations (Console UI Brief Part 3 §3) ──────────────────────

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: RoleId;
  invitedByUserId: string;
  invitedAt: string;
  status: "pending" | "revoked" | "accepted";
  emailStatus: "pending" | "sent" | "failed";
  emailSentAt: string | null;
}

// ─── Custom roles & permissions ────────────────────────────────────────

export type Permission =
  | "agents.view"
  | "agents.manage"
  | "policies.view"
  | "policies.manage"
  | "approvals.view"
  | "approvals.decide"
  | "evidence.view"
  | "evidence.export"
  | "team.manage"
  | "billing.manage"
  | "settings.manage";

export interface CustomRole {
  id: string;
  organizationId: string;
  name: string;
  permissions: Permission[];
  createdAt: string;
}

// ─── Groups ────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  organizationId: string;
  name: string;
  memberUserIds: string[];
  createdAt: string;
}

// ─── API & developer access (console-specific) ────────────────────────────

export type ApiKeyStatus = "active" | "paused";

export interface ApiKey {
  id: string;
  name: string;
  /** Only the prefix is ever shown after creation — the rest is one-time. */
  prefix: string;
  status: ApiKeyStatus;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdByUserId: string;
}

export type ConnectionStatus = "pending" | "verified" | "failed";

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  signingSecret: string;
  status: ConnectionStatus;
  statusDetail: string | null;
  checkedAt: string | null;
}

// ─── Integrations ──────────────────────────────────────────────────────

export type IntegrationKind = "slack" | "teams" | "pagerduty" | "siem" | "secrets_manager";

export interface Integration {
  id: string;
  organizationId: string;
  kind: IntegrationKind;
  /** Human-readable identifier for the connection — workspace name,
   * integration key, endpoint, or provider + path. */
  label: string;
  connectedAt: string;
  status: ConnectionStatus;
  statusDetail: string | null;
  checkedAt: string | null;
}

// ─── Security & sessions (console-specific) ───────────────────────────────

export interface LoginEvent {
  id: string;
  userId: string;
  timestamp: string;
  /** The browser's own UA string — real, not a fabricated device name. */
  userAgent: string;
}

export interface TwoFactorState {
  enabled: boolean;
  /** Base32-shaped secret for manual entry — mock, not real TOTP. */
  secret: string;
}

export interface Passkey {
  id: string;
  userId: string;
  label: string;
  createdAt: string;
}

// ─── Notification preferences (console-specific) ──────────────────────────

export type NotificationChannel = "email" | "browser" | "slack" | "teams" | "sms";
export type NotificationEvent =
  | "agent_failure"
  | "escalation_pending"
  | "weekly_report"
  | "critical_alert";

export type NotificationPrefs = Record<`${NotificationEvent}:${NotificationChannel}`, boolean>;

// ─── Billing (console-specific placeholder — Console UI Brief Part 3 §10) ─

export type Plan = "trial" | "starter" | "growth" | "enterprise";

export interface BillingInfo {
  plan: Plan;
  seatsIncluded: number;
  seatsUsed: number;
  trialEndsAt: string | null;
}

export interface PaymentMethod {
  brand: "Visa" | "Mastercard" | "American Express";
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
}

// ─── Agent registry (Console UI Brief Part 3 §2) ──────────────────────────

export type RiskBand = "low" | "medium" | "high" | "critical";
export type ConnectionMethod = "mcp" | "python_sdk" | "typescript_sdk" | "proxy";
export type AgentStatus = "active" | "watch_only" | "quarantined" | "decommissioned";

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  ownerUserId: string | null;
  environment: Environment;
  connectionMethods: ConnectionMethod[];
  status: AgentStatus;
  riskBand: RiskBand;
  hasLethalTrifecta: boolean;
  agentVersion: string;
  expiresAt: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  callVolume24h: number;
}

export type PolicyStatus = "draft" | "active";

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: PolicyStatus;
  attachedAgentCount: number;
  createdAt: string;
}

// ─── Policy / rules (Console UI Brief Part 3 §4) ──────────────────────────

export interface Rule {
  id: string;
  agentId: string | null; // null = applies to an agent group
  agentGroup: string | null;
  effect: Effect;
  matchSummary: string;
  message: string; // required for DENY/ESCALATE — a refusal without a reason is a bug
  hits7d: number;
  failMode: "open" | "closed";
  enabled: boolean;
  enforcing: boolean; // false while in detect-and-log / dry-run only
  lastEditedAt: string;
  lastEditedByUserId: string;
}

// ─── Tools & MCP servers (Console UI Brief Part 3 §6–7) ───────────────────

export type CapabilityLabel = "reads_private_data" | "sees_untrusted_content" | "can_exfiltrate";
export type ApprovalState = "approved" | "pending" | "quarantined" | "rejected";

export interface Tool {
  id: string;
  name: string;
  serverId: string;
  version: string;
  digest: string;
  approvalState: ApprovalState;
  capabilities: CapabilityLabel[];
  agentsUsing: number;
  lastSeenAt: string;
}

export type McpServerStatus = "pending" | "reachable" | "unreachable" | "local";
export type McpTransport = "http" | "stdio";

export interface McpServer {
  id: string;
  name: string;
  transport: McpTransport;
  endpoint: string | null;
  command: string | null;
  args: string[];
  description: string;
  status: McpServerStatus;
  statusDetail: string | null;
  checkedAt: string | null;
  createdAt: string;
  usedByAgentCount: number;
}

// ─── Audit log ─────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  summary: string;
  createdAt: string;
}

// ─── Monitoring ────────────────────────────────────────────────────────

export interface MonitoringHourlyBucket {
  hourStart: string;
  callCount: number;
}

export interface MonitoringAgentRow {
  agentId: string;
  agentName: string;
  environment: Environment;
  status: AgentStatus;
  callVolume24h: number;
  lastSeenAt: string | null;
}

export interface MonitoringOverview {
  totalCalls24h: number;
  activeAgents24h: number;
  idleAgents: number;
  hourlyBuckets: MonitoringHourlyBucket[];
  agents: MonitoringAgentRow[];
}

// ─── Approvals ─────────────────────────────────────────────────────────

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  actionSummary: string;
  context: string;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string | null;
  decidedByUserId: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
}
