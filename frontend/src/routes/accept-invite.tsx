import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { Lock, Eye, EyeOff, User, AtSign, ShieldCheck } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { acceptInvitation, ApiError, getInvitation, getStoredSession, type PublicInvitation } from "@/lib/api";
import { resolveRoleName } from "@/lib/roles";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: "/" });
    }
  },
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("This invitation link is missing its token.");
      return;
    }
    getInvitation(token)
      .then(setInvitation)
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "This invitation link is no longer valid.");
      });
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await acceptInvitation(token, { name, username, password });
      await navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-2 px-4 py-10">
      <Card className="grid w-full max-w-[960px] overflow-hidden border-t-2 border-t-signal p-0 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-8 border-b border-rule bg-surface-2 px-8 py-10 md:border-r md:border-b-0 md:px-10">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <Wordmark />
          </div>
          <div>
            <h1 className="font-sans text-[28px] leading-[1.15] font-bold tracking-[-0.02em] text-ink">
              You've been invited
            </h1>
            <p className="mt-2 text-[14.5px] text-slate">
              {invitation
                ? `${invitation.email} — join ${invitation.organizationName} on AgentGuard.`
                : "Set up your account to join the team."}
            </p>
          </div>
          {invitation && (
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-signal/10 text-signal">
                <ShieldCheck className="size-[18px]" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">{invitation.organizationName}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate">
                  {invitation.email} · invited as {resolveRoleName(invitation.role, [])}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center px-8 py-10 md:px-10">
          {loadError ? (
            <>
              <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Invitation unavailable</h2>
              <p
                role="alert"
                className="mt-4 rounded-[var(--radius-control)] border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-verdict-block"
              >
                {loadError}
              </p>
              <p className="mt-6 text-center text-[13px] text-slate">
                <Link to="/login" className="font-semibold text-signal hover:text-signal-deep">
                  Go to sign in
                </Link>
              </p>
            </>
          ) : !invitation ? (
            <p className="text-[13.5px] text-slate">Loading invitation…</p>
          ) : (
            <>
              <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Create your account</h2>
              <p className="mt-1 text-[13.5px] text-slate">{invitation.email}</p>

              <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                {formError && (
                  <p
                    role="alert"
                    className="rounded-[var(--radius-control)] border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-verdict-block"
                  >
                    {formError}
                  </p>
                )}

                <Field label="Your name" htmlFor="name" error={fieldErrors.name}>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    icon={<User className="size-[17px]" />}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    invalid={Boolean(fieldErrors.name)}
                    required
                  />
                </Field>

                <Field label="Username" htmlFor="username" error={fieldErrors.username}>
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder="janedoe"
                    icon={<AtSign className="size-[17px]" />}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    invalid={Boolean(fieldErrors.username)}
                    required
                  />
                </Field>

                <Field
                  label="Password"
                  htmlFor="password"
                  error={fieldErrors.password}
                  hint={!fieldErrors.password ? "At least 10 characters." : undefined}
                >
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Create a password"
                    icon={<Lock className="size-[17px]" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(fieldErrors.password)}
                    required
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="flex size-6 items-center justify-center text-slate hover:text-ink"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                      </button>
                    }
                  />
                </Field>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Joining…" : "Accept & join"}
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
