import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getMyNotificationPrefs, listMyIntegrations, updateMyNotificationPrefs } from "@/lib/api";
import type { Integration, NotificationChannel, NotificationEvent, NotificationPrefs } from "@/lib/types";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

const events: { key: NotificationEvent; label: string; description: string }[] = [
  { key: "agent_failure", label: "Agent failure", description: "An agent errors out or times out repeatedly." },
  { key: "escalation_pending", label: "Escalation pending", description: "A decision is waiting on your approval." },
  { key: "weekly_report", label: "Weekly report", description: "A summary of verdicts and activity." },
  { key: "critical_alert", label: "Critical security alert", description: "Lethal trifecta, drift, or a quarantine." },
];

const channelOrder: NotificationChannel[] = ["email", "browser", "slack", "teams", "sms"];
const channelLabel: Record<NotificationChannel, string> = {
  email: "Email",
  browser: "Browser",
  slack: "Slack",
  teams: "Teams",
  sms: "SMS",
};

function Toggle({
  checked,
  connected,
  onToggle,
  label,
}: {
  checked: boolean;
  connected: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={!connected}
      onClick={onToggle}
      title={connected ? undefined : `Connect ${label} from Integrations to enable this.`}
      aria-pressed={checked}
      aria-label={label}
      className={[
        "flex size-6 items-center justify-center border text-transparent transition-colors duration-[var(--dur-fast)]",
        !connected
          ? "cursor-not-allowed border-rule bg-surface-2 opacity-50"
          : checked
            ? "border-signal bg-signal text-paper"
            : "border-rule bg-paper hover:border-signal/50",
      ].join(" ")}
    >
      <Check className="size-[13px]" strokeWidth={3} />
    </button>
  );
}

function EventRow({
  event,
  prefs,
  channels,
  onToggle,
}: {
  event: (typeof events)[number];
  prefs: NotificationPrefs;
  channels: { key: NotificationChannel; connected: boolean }[];
  onToggle: (channel: NotificationChannel) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_repeat(5,72px)] items-center gap-2 border-b border-rule px-5 py-3.5 last:border-0">
      <div>
        <p className="text-[13px] font-medium text-ink">{event.label}</p>
        <p className="text-[11.5px] text-slate">{event.description}</p>
      </div>
      {channels.map((c) => (
        <div key={c.key} className="flex justify-center">
          <Toggle
            checked={prefs[`${event.key}:${c.key}`]}
            connected={c.connected}
            onToggle={() => onToggle(c.key)}
            label={`${event.label} via ${channelLabel[c.key]}`}
          />
        </div>
      ))}
    </div>
  );
}

function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    getMyNotificationPrefs().then(setPrefs);
    listMyIntegrations().then(setIntegrations);
  }, []);

  const channels: { key: NotificationChannel; connected: boolean }[] = channelOrder.map((key) => ({
    key,
    connected:
      key === "email" || key === "browser"
        ? true
        : key === "sms"
          ? false
          : integrations.some((i) => i.kind === key),
  }));

  async function toggle(event: NotificationEvent, channel: NotificationChannel) {
    if (!prefs) return;
    const key = `${event}:${channel}` as const;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await updateMyNotificationPrefs({ [key]: next[key] });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Notifications</h1>
      <p className="mt-1 text-[13.5px] text-slate">Choose what you hear about, and where.</p>

      <Card className="mt-6 overflow-x-auto p-0">
        <div className="grid min-w-[680px] grid-cols-[1fr_repeat(5,72px)] items-end gap-2 border-b border-rule px-5 py-2.5">
          <span />
          {channels.map((c) => (
            <span key={c.key} className="text-center text-[10.5px] font-semibold text-slate uppercase">
              {channelLabel[c.key]}
              {!c.connected && <span className="block text-[9px] font-normal normal-case">not connected</span>}
            </span>
          ))}
        </div>

        <div className="min-w-[680px]">
          {prefs === null ? (
            <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>
          ) : (
            events.map((ev) => (
              <EventRow
                key={ev.key}
                event={ev}
                prefs={prefs}
                channels={channels}
                onToggle={(channel) => toggle(ev.key, channel)}
              />
            ))
          )}
        </div>
      </Card>

      <p className="mt-3 text-[12px] text-slate">
        Slack and Teams turn on here automatically once connected from{" "}
        <Link to="/integrations" className="font-medium text-signal hover:text-signal-deep">
          Integrations
        </Link>
        . SMS has no provider yet.
      </p>
    </div>
  );
}
