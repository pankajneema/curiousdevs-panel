const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const SESSION_KEY = "agentguard_console_session";

export class ApiError extends Error {
  readonly field?: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.field = field;
  }
}

function getToken(): string | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/** A 401 means the token the server saw wasn't valid — stop pretending
 * there's a session and send the user back to sign in. */
function handleUnauthorized(): never {
  localStorage.removeItem(SESSION_KEY);
  if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
    window.location.href = "/login";
  }
  throw new ApiError("Not signed in.");
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) handleUnauthorized();

  if (!res.ok) {
    let message = "Something went wrong. Try again.";
    let field: string | undefined;
    try {
      const data = (await res.json()) as { detail?: { message?: string; field?: string } | string };
      if (typeof data.detail === "string") message = data.detail;
      else if (data.detail?.message) {
        message = data.detail.message;
        field = data.detail.field;
      }
    } catch {
      // fall through to the generic message
    }
    throw new ApiError(message, field);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
