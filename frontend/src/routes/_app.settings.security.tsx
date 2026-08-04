import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Fingerprint, KeyRound, Laptop, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  addMyPasskey,
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getSecuritySummary,
  getStoredSession,
  listMyLoginEvents,
  regenerateRecoveryCodes,
  removeMyPasskey,
  startTwoFactorSetup,
  type SecuritySummary,
} from "@/lib/api";
import { formatDate, formatTime, usePreferences } from "@/lib/preferences";
import type { LoginEvent } from "@/lib/types";

export const Route = createFileRoute("/_app/settings/security")({
  component: SecurityPage,
});

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.field === "currentPassword") {
        setFieldError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <p className="text-[13px] font-semibold text-ink">Change password</p>
      <form className="mt-4 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="border border-verdict-allow/30 bg-verdict-allow/10 px-3 py-2 text-[13px] text-ink">
            Password changed.
          </p>
        )}
        <Field label="Current password" htmlFor="current-password" error={fieldError ?? undefined}>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            invalid={Boolean(fieldError)}
            required
          />
        </Field>
        <Field label="New password" htmlFor="new-password" hint="At least 10 characters.">
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </Field>
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RecoveryCodesReveal({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyAll() {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-rule bg-signal/5 px-5 py-4">
      <p className="text-[12.5px] font-medium text-ink">
        Save these recovery codes now — each works once, and you won't see them again.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 font-machine text-[12.5px] text-ink sm:grid-cols-3">
        {codes.map((code) => (
          <code key={code} className="border border-rule bg-paper px-2 py-1.5">
            {code}
          </code>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopyAll}>
          {copied ? <Check className="size-[13px] text-verdict-allow" /> : <Copy className="size-[13px]" />}
          Copy all
        </Button>
        <Button size="sm" onClick={onDone}>
          I've saved these
        </Button>
      </div>
    </div>
  );
}

function TwoFactorRow({ summary, onChanged }: { summary: SecuritySummary; onChanged: () => void }) {
  const [settingUp, setSettingUp] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [revealCodes, setRevealCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function handleStart() {
    setSettingUp(true);
    setSecret(await startTwoFactorSetup());
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const codes = await confirmTwoFactorSetup(code);
      setRevealCodes(codes);
      setSettingUp(false);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    await disableTwoFactor();
    setDisabling(false);
    onChanged();
  }

  return (
    <div className="border-b border-rule last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
            <ShieldCheck className="size-[16px]" />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-ink">Two-factor authentication</p>
            <p className="text-[12px] text-slate">TOTP codes from an authenticator app.</p>
          </div>
        </div>
        {summary.twoFactorEnabled ? (
          <span className="flex items-center gap-2">
            <span className="rounded-[var(--radius-chip)] border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
              Enabled
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDisabling((v) => !v)}>
              Disable
            </Button>
          </span>
        ) : (
          !settingUp &&
          !revealCodes && (
            <Button variant="secondary" size="sm" onClick={handleStart}>
              Set up
            </Button>
          )
        )}
      </div>

      {disabling && (
        <div className="border-t border-rule bg-verdict-block/5 px-5 py-4">
          <p className="text-[12.5px] text-ink">
            Turning this off removes your recovery codes too. You'll need to set it up again from scratch.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDisable}>
              Turn off 2FA
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDisabling(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {settingUp && secret && (
        <form className="border-t border-rule bg-surface-2 px-5 py-4" onSubmit={handleVerify} noValidate>
          {error && (
            <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <p className="text-[12.5px] text-ink">
            Add this key to your authenticator app (Google Authenticator, 1Password, Authy):
          </p>
          <code className="mt-2 block border border-rule bg-paper px-3 py-2 font-machine text-[13px] tracking-widest text-ink">
            {secret}
          </code>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <Field label="6-digit code" htmlFor="totp-code">
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Verifying…" : "Verify & enable"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSettingUp(false)}>
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate">
            Mock console — this isn't wired to a real authenticator, any 6-digit code is accepted.
          </p>
        </form>
      )}

      {revealCodes && (
        <RecoveryCodesReveal
          codes={revealCodes}
          onDone={() => {
            setRevealCodes(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PasskeysRow({ summary, onChanged }: { summary: SecuritySummary; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addMyPasskey(label);
      setLabel("");
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    await removeMyPasskey(id);
    onChanged();
  }

  return (
    <div className="border-b border-rule last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
            <Fingerprint className="size-[16px]" />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-ink">Passkeys</p>
            <p className="text-[12px] text-slate">Sign in with Face ID, Touch ID or a security key.</p>
          </div>
        </div>
        {!adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-[13px]" /> Add passkey
          </Button>
        )}
      </div>

      {summary.passkeys.length > 0 && (
        <div className="divide-y divide-rule border-t border-rule">
          {summary.passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <span className="text-[13px] text-ink">{pk.label}</span>
              <button
                onClick={() => handleRemove(pk.id)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-slate hover:text-verdict-block"
              >
                <Trash2 className="size-[12px]" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form className="border-t border-rule bg-surface-2 px-5 py-4" onSubmit={handleAdd} noValidate>
          {error && (
            <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Name this passkey" htmlFor="passkey-label">
                <Input
                  id="passkey-label"
                  placeholder="e.g. MacBook Touch ID"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate">
            Mock console — this isn't wired to real WebAuthn, no device prompt will appear.
          </p>
        </form>
      )}
    </div>
  );
}

function RecoveryCodesRow({ summary, onChanged }: { summary: SecuritySummary; onChanged: () => void }) {
  const [revealCodes, setRevealCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setError(null);
    try {
      setRevealCodes(await regenerateRecoveryCodes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
            <KeyRound className="size-[16px]" />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-ink">Recovery codes</p>
            <p className="text-[12px] text-slate">
              {summary.twoFactorEnabled
                ? `${summary.recoveryCodeCount} unused codes.`
                : "Turn on two-factor authentication first."}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!summary.twoFactorEnabled}
          title={summary.twoFactorEnabled ? undefined : "Enable two-factor authentication first."}
          onClick={handleRegenerate}
        >
          Regenerate
        </Button>
      </div>
      {error && (
        <p role="alert" className="mx-5 mb-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      {revealCodes && (
        <RecoveryCodesReveal
          codes={revealCodes}
          onDone={() => {
            setRevealCodes(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function SecurityPage() {
  const session = getStoredSession()!;
  const { preferences } = usePreferences();
  const [events, setEvents] = useState<LoginEvent[] | null>(null);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function refreshSummary() {
    setSummaryError(null);
    try {
      setSummary(await getSecuritySummary());
    } catch (err) {
      setSummaryError(err instanceof ApiError ? err.message : "Couldn't load this section. Try reloading the page.");
    }
  }

  useEffect(() => {
    listMyLoginEvents().then(setEvents);
    refreshSummary();
  }, []);

  const currentEvent = events?.[0];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-[13.5px] text-slate">Password, sessions and stronger sign-in methods.</p>

      <div className="mt-6 flex flex-col gap-6">
        <ChangePasswordCard />

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Active session</p>
          </div>
          {currentEvent ? (
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
                <Laptop className="size-[16px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">This device</p>
                <p className="truncate text-[12px] text-slate">{currentEvent.userAgent}</p>
              </div>
              <span className="rounded-[var(--radius-chip)] border border-verdict-allow/30 bg-verdict-allow/10 px-2.5 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
                Active now
              </span>
            </div>
          ) : (
            <p className="px-5 py-6 text-[13px] text-slate">No session data yet.</p>
          )}
        </Card>

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Login history</p>
          </div>
          <div className="divide-y divide-rule">
            {events === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
            {events?.length === 0 && <p className="px-5 py-6 text-[13px] text-slate">No login history yet.</p>}
            {events?.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="truncate text-[12.5px] text-ink">{e.userAgent}</span>
                <span className="shrink-0 font-machine text-[11px] text-slate">
                  {formatDate(e.timestamp, preferences)} {formatTime(e.timestamp, preferences)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Stronger sign-in</p>
          </div>
          {summaryError ? (
            <div className="flex items-center justify-between gap-4 px-5 py-6">
              <p className="text-[13px] text-verdict-block">{summaryError}</p>
              <Button variant="secondary" size="sm" onClick={refreshSummary}>
                Retry
              </Button>
            </div>
          ) : summary === null ? (
            <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>
          ) : (
            <>
              <TwoFactorRow summary={summary} onChanged={refreshSummary} />
              <PasskeysRow summary={summary} onChanged={refreshSummary} />
              <RecoveryCodesRow summary={summary} onChanged={refreshSummary} />
            </>
          )}
        </Card>

        <p className="text-[12px] text-slate">
          Signed in as <span className="font-machine">{session.user.email}</span>.
        </p>
      </div>
    </div>
  );
}
