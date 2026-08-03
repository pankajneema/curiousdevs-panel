import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, createMyApiKey, listMyApiKeys, revokeMyApiKey, setApiKeyStatus } from "@/lib/api";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { ApiKey } from "@/lib/types";

export const Route = createFileRoute("/_app/developer")({
  component: DeveloperPage,
});

type ExpiryChoice = "30d" | "90d" | "1y" | "never";

const expiryOptions: { value: ExpiryChoice; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "never", label: "Never" },
];

function expiryToIso(choice: ExpiryChoice): string | null {
  if (choice === "never") return null;
  const days = choice === "30d" ? 30 : choice === "90d" ? 90 : 365;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(key: ApiKey): boolean {
  return key.expiresAt !== null && new Date(key.expiresAt).getTime() < Date.now();
}

function StatusChip({ apiKey }: { apiKey: ApiKey }) {
  if (isExpired(apiKey)) {
    return (
      <span className="rounded-[var(--radius-chip)] border border-verdict-block/30 bg-verdict-block/10 px-2 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
        Expired
      </span>
    );
  }
  return apiKey.status === "active" ? (
    <span className="rounded-[var(--radius-chip)] border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
      Active
    </span>
  ) : (
    <span className="rounded-[var(--radius-chip)] border border-verdict-escalate/30 bg-verdict-escalate/10 px-2 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
      Paused
    </span>
  );
}

function ApiKeysCard() {
  const { preferences } = usePreferences();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryChoice>("90d");
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setKeys(await listMyApiKeys());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { secret } = await createMyApiKey({ name, expiresAt: expiryToIso(expiry) });
      setRevealedSecret(secret);
      setName("");
      setExpiry("90d");
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(key: ApiKey) {
    await setApiKeyStatus(key.id, key.status === "active" ? "paused" : "active");
    await refresh();
  }

  async function handleRevoke(id: string) {
    await revokeMyApiKey(id);
    await refresh();
  }

  async function handleCopySecret() {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">API keys</p>
          <p className="mt-0.5 text-[12px] text-slate">
            What agents and the CLI use to authenticate against AgentGuard.
          </p>
        </div>
        {!creating && !revealedSecret && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-[14px]" /> New key
          </Button>
        )}
      </div>

      {revealedSecret && (
        <div className="border-b border-rule bg-signal/5 px-5 py-4">
          <p className="text-[12.5px] font-medium text-ink">
            Copy this key now — you won't be able to see it again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto border border-rule bg-paper px-3 py-2 font-machine text-[12.5px] text-ink">
              {revealedSecret}
            </code>
            <button
              type="button"
              onClick={handleCopySecret}
              aria-label="Copy key"
              className="flex size-9 shrink-0 items-center justify-center border border-rule text-slate hover:text-ink"
            >
              {copied ? <Check className="size-[15px] text-verdict-allow" /> : <Copy className="size-[15px]" />}
            </button>
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setRevealedSecret(null)}>
            Done
          </Button>
        </div>
      )}

      {creating && (
        <form className="border-b border-rule px-5 py-4" onSubmit={handleCreate} noValidate>
          {error && (
            <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Key name" htmlFor="key-name">
                <Input
                  id="key-name"
                  placeholder="e.g. production-support-agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="w-36">
              <Field label="Expires" htmlFor="key-expiry">
                <select
                  id="key-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                  className="h-11 w-full border border-rule bg-paper px-3 text-[14px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                >
                  {expiryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Name</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Key</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Created</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Expires</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys === null && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-[13px] text-slate">
                  Loading…
                </td>
              </tr>
            )}
            {keys?.length === 0 && !creating && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-[13px] text-slate">
                  No API keys yet.
                </td>
              </tr>
            )}
            {keys?.map((key) => (
              <tr key={key.id} className="border-b border-rule last:border-0">
                <td className="px-5 py-3 text-[13.5px] font-medium text-ink">{key.name}</td>
                <td className="px-3 py-3 font-machine text-[12px] text-slate">{key.prefix}</td>
                <td className="px-3 py-3 text-[12px] text-slate">{formatDate(key.createdAt, preferences)}</td>
                <td className="px-3 py-3 text-[12px] text-slate">
                  {key.expiresAt ? formatDate(key.expiresAt, preferences) : "Never"}
                </td>
                <td className="px-3 py-3">
                  <StatusChip apiKey={key} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleToggleStatus(key)}
                      className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-signal/40 hover:text-signal"
                    >
                      {key.status === "active" ? (
                        <>
                          <Pause className="size-[13px]" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="size-[13px]" /> Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                    >
                      <Trash2 className="size-[13px]" /> Revoke
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-rule px-5 py-3 text-[12px] text-slate">
        A paused key stops authenticating immediately but keeps its history — revoke deletes it for good.
        The CLI and OAuth apps use this same key mechanism — dedicated flows for each aren't built yet.
      </p>
    </Card>
  );
}

function DeveloperPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">API & developer</h1>
      <p className="mt-1 text-[13.5px] text-slate">Programmatic access to this organization.</p>
      <div className="mt-6">
        <ApiKeysCard />
      </div>
    </div>
  );
}
