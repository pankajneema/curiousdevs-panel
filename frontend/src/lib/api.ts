/**
 * The API layer. Every screen goes through here, never fetches directly —
 * this is the one place that knows the backend's URL shape. Talks to the
 * real FastAPI + Postgres backend in backend/.
 */
import { useSyncExternalStore } from "react";
import { api, ApiError } from "./apiClient";
import { BUILT_IN_ROLES } from "./roles";
import type {
  Agent,
  ApiKey,
  BillingInfo,
  CustomRole,
  Group,
  Integration,
  Invitation,
  LoginEvent,
  NotificationPrefs,
  Passkey,
  PaymentMethod,
  Permission,
  Plan,
  RoleId,
  Session,
  User,
  Webhook,
} from "./types";

export { ApiError };
export type { Session };

const SESSION_KEY = "agentguard_console_session";

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// useSyncExternalStore requires getSnapshot to return a *stable* reference
// when nothing has changed — readSession() parses fresh JSON every call, so
// a naive getSnapshot would return a new object every render and loop
// forever. Cache the snapshot and only replace it when the session actually
// changes (storeSession/logout below).
let sessionSnapshot: Session | null = readSession();
const sessionListeners = new Set<() => void>();

function setSessionSnapshot(session: Session | null): void {
  sessionSnapshot = session;
  sessionListeners.forEach((listener) => listener());
}

/** Lets components (e.g. the layout that feeds Header/Sidebar their user)
 * re-render when the session changes anywhere — profile edits, avatar
 * uploads, login — without threading state through every call site. */
export function subscribeToSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function storeSession(session: Session): Session {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setSessionSnapshot(session);
  return session;
}

/** Synchronous — read on app boot before the first render, no spinner
 * needed. The backend is the real source of truth; this is a fast local
 * cache for the initial paint, revalidated by every subsequent API call. */
export function getStoredSession(): Session | null {
  return readSession();
}

/** Reactive version of getStoredSession — re-renders the caller whenever the
 * session changes (profile edits, avatar uploads, login, logout), unlike a
 * one-off getStoredSession() call which only reflects state at mount time. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeToSession, () => sessionSnapshot, () => sessionSnapshot);
}

// ─── Auth ──────────────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  password: string;
  organizationName: string;
}

export async function register(input: RegisterInput): Promise<Session> {
  const session = await api.post<Session>("/auth/register", input);
  return storeSession(session);
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  requiresTwoFactor: boolean;
  pendingToken: string | null;
  session: Session | null;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const result = await api.post<LoginResult>("/auth/login", input);
  if (result.session) storeSession(result.session);
  return result;
}

export async function verifyTwoFactorLogin(input: { pendingToken: string; code: string }): Promise<Session> {
  const session = await api.post<Session>("/auth/login/verify-2fa", input);
  return storeSession(session);
}

export async function logout(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  setSessionSnapshot(null);
}

// ─── Agents ────────────────────────────────────────────────────────────

export async function listAgents(): Promise<Agent[]> {
  return api.get<Agent[]>("/agents");
}

// ─── Profile ───────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  name: string;
  username: string;
  phone: string;
  jobTitle: string;
  department: string;
  bio: string;
  timezone: string;
  language: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<Session> {
  const session = await api.patch<Session>("/profile", input);
  return storeSession(session);
}

export async function updateAvatar(avatarUrl: string | null): Promise<Session> {
  const session = await api.patch<Session>("/profile/avatar", { avatarUrl });
  return storeSession(session);
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await api.post<void>("/profile/password", input);
}

// ─── Organization / Settings ──────────────────────────────────────────

export interface UpdateOrganizationInput {
  name: string;
}

export async function updateOrganization(input: UpdateOrganizationInput): Promise<Session> {
  const session = await api.patch<Session>("/organization", input);
  return storeSession(session);
}

// ─── Team ──────────────────────────────────────────────────────────────

export async function listTeam(): Promise<{ members: User[]; invitations: Invitation[] }> {
  return api.get("/team");
}

export interface InviteTeamMemberInput {
  email: string;
  role: RoleId;
}

export async function inviteTeamMember(input: InviteTeamMemberInput): Promise<Invitation> {
  return api.post<Invitation>("/team/invite", input);
}

export async function revokeTeamInvitation(id: string): Promise<void> {
  await api.post<void>(`/team/invitations/${id}/revoke`);
}

export async function removeTeamMember(userId: string): Promise<void> {
  await api.delete<void>(`/team/members/${userId}`);
}

export async function updateMemberRole(userId: string, role: RoleId): Promise<void> {
  await api.patch<void>(`/team/members/${userId}/role`, { role });
}

// ─── Roles ─────────────────────────────────────────────────────────────

export async function listRoles(): Promise<{ builtIn: typeof BUILT_IN_ROLES; custom: CustomRole[] }> {
  return api.get("/roles");
}

export interface CreateRoleInput {
  name: string;
  permissions: Permission[];
}

export async function createRole(input: CreateRoleInput): Promise<CustomRole> {
  return api.post<CustomRole>("/roles", input);
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete<void>(`/roles/${id}`);
}

// ─── Groups ────────────────────────────────────────────────────────────

export async function listGroups(): Promise<Group[]> {
  return api.get<Group[]>("/groups");
}

export async function createGroup(name: string): Promise<Group> {
  return api.post<Group>("/groups", { name });
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete<void>(`/groups/${id}`);
}

export async function updateGroupMembers(id: string, memberUserIds: string[]): Promise<Group> {
  return api.put<Group>(`/groups/${id}/members`, { memberUserIds });
}

// ─── Billing ───────────────────────────────────────────────────────────

export async function getBilling(): Promise<BillingInfo> {
  return api.get<BillingInfo>("/billing");
}

export async function upgradePlan(plan: Plan): Promise<BillingInfo> {
  return api.post<BillingInfo>("/billing/upgrade", { plan });
}

export async function getMyPaymentMethod(): Promise<PaymentMethod | null> {
  return api.get<PaymentMethod | null>("/billing/payment-method");
}

export interface AddPaymentMethodInput {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export async function addPaymentMethod(input: AddPaymentMethodInput): Promise<PaymentMethod> {
  return api.post<PaymentMethod>("/billing/payment-method", input);
}

export async function removeMyPaymentMethod(): Promise<void> {
  await api.delete<void>("/billing/payment-method");
}

// ─── Security ──────────────────────────────────────────────────────────

export async function listMyLoginEvents(): Promise<LoginEvent[]> {
  return api.get<LoginEvent[]>("/security/login-events");
}

export interface SecuritySummary {
  twoFactorEnabled: boolean;
  recoveryCodeCount: number;
  passkeys: Passkey[];
}

export async function getSecuritySummary(): Promise<SecuritySummary> {
  return api.get<SecuritySummary>("/security/summary");
}

export async function startTwoFactorSetup(): Promise<string> {
  const { secret } = await api.post<{ secret: string }>("/security/2fa/start");
  return secret;
}

export async function confirmTwoFactorSetup(code: string): Promise<string[]> {
  return api.post<string[]>("/security/2fa/confirm", { code });
}

export async function disableTwoFactor(): Promise<void> {
  await api.post<void>("/security/2fa/disable");
}

export async function regenerateRecoveryCodes(): Promise<string[]> {
  return api.post<string[]>("/security/recovery-codes/regenerate");
}

export async function addMyPasskey(label: string): Promise<Passkey> {
  return api.post<Passkey>("/security/passkeys", { label });
}

export async function removeMyPasskey(id: string): Promise<void> {
  await api.delete<void>(`/security/passkeys/${id}`);
}

// ─── API keys ──────────────────────────────────────────────────────────

export async function listMyApiKeys(): Promise<ApiKey[]> {
  return api.get<ApiKey[]>("/api-keys");
}

export interface CreateApiKeyInput {
  name: string;
  expiresAt: string | null;
}

export async function createMyApiKey(input: CreateApiKeyInput): Promise<{ key: ApiKey; secret: string }> {
  return api.post("/api-keys", input);
}

export async function setApiKeyStatus(id: string, status: ApiKey["status"]): Promise<void> {
  await api.patch<void>(`/api-keys/${id}/status`, { status });
}

export async function revokeMyApiKey(id: string): Promise<void> {
  await api.delete<void>(`/api-keys/${id}`);
}

// ─── Webhooks ──────────────────────────────────────────────────────────

export async function listMyWebhooks(): Promise<Webhook[]> {
  return api.get<Webhook[]>("/webhooks");
}

export async function createMyWebhook(input: { url: string; events: string[] }): Promise<Webhook> {
  return api.post<Webhook>("/webhooks", input);
}

export async function deleteMyWebhook(id: string): Promise<void> {
  await api.delete<void>(`/webhooks/${id}`);
}

// ─── Notification preferences ─────────────────────────────────────────

export async function getMyNotificationPrefs(): Promise<NotificationPrefs> {
  return api.get<NotificationPrefs>("/notifications");
}

export async function updateMyNotificationPrefs(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  return api.patch<NotificationPrefs>("/notifications", patch);
}

// ─── Integrations ──────────────────────────────────────────────────────

export async function listMyIntegrations(): Promise<Integration[]> {
  return api.get<Integration[]>("/integrations");
}

export interface ConnectIntegrationInput {
  kind: Integration["kind"];
  label: string;
}

export async function connectMyIntegration(input: ConnectIntegrationInput): Promise<Integration> {
  return api.post<Integration>("/integrations", input);
}

export async function disconnectMyIntegration(id: string): Promise<void> {
  await api.delete<void>(`/integrations/${id}`);
}
