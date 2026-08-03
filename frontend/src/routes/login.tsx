import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, SlidersHorizontal, FileClock, CircleAlert, KeyRound } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { ApiError, getStoredSession, login, verifyTwoFactorLogin } from "@/lib/api";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const features = [
  {
    icon: ShieldCheck,
    title: "Agent identity",
    body: "Every agent carries a scoped, short-lived, cryptographically-verifiable identity.",
  },
  {
    icon: SlidersHorizontal,
    title: "Policy engine",
    body: "Review and enforce every high-risk decision before it reaches production.",
  },
  {
    icon: FileClock,
    title: "Flight recorder",
    body: "A tamper-evident, append-only record of every call, verdict and outcome.",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login({ email, password });
      if (result.requiresTwoFactor && result.pendingToken) {
        setPendingToken(result.pendingToken);
      } else {
        await navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyTwoFactor(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!pendingToken) throw new Error("Missing pending token.");
      await verifyTwoFactorLogin({ pendingToken, code });
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
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
            <h1
              className="font-sans text-[28px] leading-[1.15] font-bold tracking-[-0.02em] text-ink"
            >
              Welcome back
            </h1>
            <p className="mt-2 text-[14.5px] text-slate">
              Sign in to access your CuriousDevs console.
            </p>
          </div>
          <ul className="flex flex-col gap-5">
            {features.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-signal/10 text-signal">
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-center px-8 py-10 md:px-10">
          {pendingToken ? (
            <>
              <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Two-factor code</h2>
              <p className="mt-1 text-[13.5px] text-slate">
                Enter the 6-digit code from your authenticator app.
              </p>

              <form className="mt-7 flex flex-col gap-5" onSubmit={handleVerifyTwoFactor} noValidate>
                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--radius-control)] border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink"
                  >
                    <CircleAlert className="mt-0.5 size-[15px] shrink-0 text-verdict-block" />
                    {error}
                  </p>
                )}

                <Field label="6-digit code" htmlFor="totp-code">
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    placeholder="000000"
                    icon={<KeyRound className="size-[17px]" />}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                    required
                  />
                </Field>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Verifying…" : "Verify & sign in"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setPendingToken(null);
                    setCode("");
                    setError(null);
                  }}
                >
                  Back to sign in
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Sign in</h2>
              <p className="mt-1 text-[13.5px] text-slate">Enter your credentials to continue.</p>

              <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--radius-control)] border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink"
                  >
                    <CircleAlert className="mt-0.5 size-[15px] shrink-0 text-verdict-block" />
                    {error}
                  </p>
                )}

                <Field label="Email address" htmlFor="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    icon={<Mail className="size-[17px]" />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    icon={<Lock className="size-[17px]" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

                <div className="flex items-center justify-between">
                  <Checkbox
                    id="remember"
                    label="Remember me"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="text-[13px] font-medium text-slate">Forgot password?</span>
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-[13px] text-slate">
                Don't have an account?{" "}
                <Link to="/register" className="font-semibold text-signal hover:text-signal-deep">
                  Create one
                </Link>
              </p>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
