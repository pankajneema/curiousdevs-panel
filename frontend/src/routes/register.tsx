import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { Mail, Lock, Eye, EyeOff, User, AtSign, Building2, Globe, ShieldCheck, SlidersHorizontal, FileClock } from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, getStoredSession, register } from "@/lib/api";
import type { DataResidency } from "@/lib/types";

const dataResidencyOptions: { value: DataResidency; label: string }[] = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
];

export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: "/" });
    }
  },
  component: RegisterPage,
});

const features = [
  { icon: ShieldCheck, title: "Agent identity", body: "Scoped, short-lived credentials for every agent." },
  { icon: SlidersHorizontal, title: "Policy engine", body: "Enforce and review high-risk decisions in real time." },
  { icon: FileClock, title: "Flight recorder", body: "A tamper-evident record of every call and verdict." },
];

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [dataResidency, setDataResidency] = useState<DataResidency>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({ name, username, organizationName, email, password, dataResidency });
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
              Create your console
            </h1>
            <p className="mt-2 text-[14.5px] text-slate">
              Set up your organization and start enforcing agent policy.
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
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Create account</h2>
          <p className="mt-1 text-[13.5px] text-slate">You'll be the owner of this organization.</p>

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
                name="name"
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
                name="username"
                autoComplete="username"
                placeholder="janedoe"
                icon={<AtSign className="size-[17px]" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                invalid={Boolean(fieldErrors.username)}
                required
              />
            </Field>

            <Field label="Organization name" htmlFor="organizationName" error={fieldErrors.organizationName}>
              <Input
                id="organizationName"
                name="organizationName"
                autoComplete="organization"
                placeholder="Acme Inc."
                icon={<Building2 className="size-[17px]" />}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                invalid={Boolean(fieldErrors.organizationName)}
                required
              />
            </Field>

            <Field
              label="Data residency"
              htmlFor="dataResidency"
              hint="Fixed once your organization is created."
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate">
                  <Globe className="size-[17px]" />
                </span>
                <select
                  id="dataResidency"
                  name="dataResidency"
                  value={dataResidency}
                  onChange={(e) => setDataResidency(e.target.value as DataResidency)}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-rule bg-paper pr-3.5 pl-10 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                >
                  {dataResidencyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Work email" htmlFor="email" error={fieldErrors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                icon={<Mail className="size-[17px]" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={Boolean(fieldErrors.email)}
                required
              />
            </Field>

            <Field label="Password" htmlFor="password" error={fieldErrors.password} hint={!fieldErrors.password ? "At least 10 characters." : undefined}>
              <Input
                id="password"
                name="password"
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
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-slate">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-signal hover:text-signal-deep">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </main>
  );
}
