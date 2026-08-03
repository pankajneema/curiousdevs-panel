import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Plus, RadioTower, Siren, LockKeyhole, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  connectMyIntegration,
  createMyWebhook,
  deleteMyWebhook,
  disconnectMyIntegration,
  listMyIntegrations,
  listMyWebhooks,
} from "@/lib/api";
import type { Integration, IntegrationKind, Webhook } from "@/lib/types";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});

const webhookEvents = ["decision.blocked", "decision.escalated", "agent.quarantined", "policy.updated"];

interface IntegrationConfig {
  kind: IntegrationKind;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  group: "Alerts & approvals" | "Data & security";
}

const integrationConfigs: IntegrationConfig[] = [
  {
    kind: "slack",
    icon: MessageSquare,
    title: "Slack",
    description: "Escalations and alerts in a channel.",
    fieldLabel: "Workspace name",
    placeholder: "acme-corp",
    group: "Alerts & approvals",
  },
  {
    kind: "teams",
    icon: MessageSquare,
    title: "Microsoft Teams",
    description: "Escalations and alerts in a channel.",
    fieldLabel: "Team name",
    placeholder: "Security Team",
    group: "Alerts & approvals",
  },
  {
    kind: "pagerduty",
    icon: Siren,
    title: "PagerDuty",
    description: "Page on-call for critical alerts.",
    fieldLabel: "Integration key",
    placeholder: "R0XXXXXXXXXXXXXXXXXXXXXXXX",
    group: "Alerts & approvals",
  },
  {
    kind: "siem",
    icon: RadioTower,
    title: "SIEM export",
    description: "Stream decision records to your SIEM.",
    fieldLabel: "Endpoint URL",
    placeholder: "https://siem.example.com/ingest",
    group: "Data & security",
  },
  {
    kind: "secrets_manager",
    icon: LockKeyhole,
    title: "Secret manager",
    description: "Pull API keys from Vault or AWS Secrets Manager.",
    fieldLabel: "Provider & path",
    placeholder: "AWS Secrets Manager · /agentguard/prod",
    group: "Data & security",
  },
];

function IntegrationRow({
  config,
  integration,
  onChanged,
}: {
  config: IntegrationConfig;
  integration: Integration | undefined;
  onChanged: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const Icon = config.icon;

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await connectMyIntegration({ kind: config.kind, label: value });
      setValue("");
      setConnecting(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!integration) return;
    await disconnectMyIntegration(integration.id);
    onChanged();
  }

  return (
    <div className="border-b border-rule last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
            <Icon className="size-[16px]" />
          </span>
          <div>
            <p className="text-[13.5px] font-medium text-ink">{config.title}</p>
            <p className="text-[12px] text-slate">
              {integration ? integration.label : config.description}
            </p>
          </div>
        </div>
        {integration ? (
          <span className="flex items-center gap-2">
            <span className="rounded-[var(--radius-chip)] border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] tracking-wide text-ink uppercase">
              Connected
            </span>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
            >
              <Trash2 className="size-[13px]" /> Disconnect
            </button>
          </span>
        ) : (
          !connecting && (
            <Button variant="secondary" size="sm" onClick={() => setConnecting(true)}>
              Connect
            </Button>
          )
        )}
      </div>
      {connecting && (
        <form className="border-t border-rule bg-surface-2 px-5 py-4" onSubmit={handleConnect} noValidate>
          {error && (
            <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label={config.fieldLabel} htmlFor={`connect-${config.kind}`}>
                <Input
                  id={`connect-${config.kind}`}
                  placeholder={config.placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Connecting…" : "Connect"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConnecting(false)}>
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate">Mock console — nothing external is actually contacted.</p>
        </form>
      )}
    </div>
  );
}

function WebhooksCard() {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setWebhooks(await listMyWebhooks());
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createMyWebhook({ url, events: selectedEvents });
      setUrl("");
      setSelectedEvents([]);
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteMyWebhook(id);
    await refresh();
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center bg-surface-2 text-slate">
            <WebhookIcon className="size-[15px]" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Webhooks</p>
            <p className="mt-0.5 text-[12px] text-slate">Send events to your own endpoint with a signing secret.</p>
          </div>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-[14px]" /> New webhook
          </Button>
        )}
      </div>

      {creating && (
        <form className="border-b border-rule px-5 py-4" onSubmit={handleCreate} noValidate>
          {error && (
            <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          <Field label="Endpoint URL" htmlFor="webhook-url">
            <Input
              id="webhook-url"
              placeholder="https://your-service.com/webhooks/agentguard"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </Field>
          <p className="mt-4 text-[12px] font-medium text-ink">Events</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {webhookEvents.map((ev) => (
              <button
                type="button"
                key={ev}
                onClick={() => toggleEvent(ev)}
                className={[
                  "border px-2.5 py-1 font-machine text-[11px] tracking-wide",
                  selectedEvents.includes(ev)
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-rule text-slate hover:text-ink",
                ].join(" ")}
              >
                {ev}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add webhook"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="divide-y divide-rule">
        {webhooks === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
        {webhooks?.length === 0 && !creating && (
          <p className="px-5 py-6 text-[13px] text-slate">No webhooks configured.</p>
        )}
        {webhooks?.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="font-machine text-[12.5px] text-ink">{w.url}</p>
              <p className="mt-0.5 text-[12px] text-slate">{w.events.join(", ")}</p>
            </div>
            <button
              onClick={() => handleDelete(w.id)}
              className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
            >
              <Trash2 className="size-[13px]" /> Remove
            </button>
          </div>
        ))}
      </div>

      <p className="border-t border-rule px-5 py-3 text-[12px] text-slate">
        No deliveries yet — the delivery log appears here once traffic starts.
      </p>
    </Card>
  );
}

function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);

  async function refresh() {
    setIntegrations(await listMyIntegrations());
  }

  useEffect(() => {
    refresh();
  }, []);

  function findFor(kind: IntegrationKind) {
    return integrations?.find((i) => i.kind === kind);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Integrations</h1>
      <p className="mt-1 text-[13.5px] text-slate">Connect AgentGuard to the rest of your stack.</p>

      <div className="mt-6 flex flex-col gap-6">
        <WebhooksCard />

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Alerts & approvals</p>
          </div>
          {integrationConfigs
            .filter((c) => c.group === "Alerts & approvals")
            .map((c) => (
              <IntegrationRow key={c.kind} config={c} integration={findFor(c.kind)} onChanged={refresh} />
            ))}
        </Card>

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Data & security</p>
          </div>
          {integrationConfigs
            .filter((c) => c.group === "Data & security")
            .map((c) => (
              <IntegrationRow key={c.kind} config={c} integration={findFor(c.kind)} onChanged={refresh} />
            ))}
        </Card>
      </div>
    </div>
  );
}
