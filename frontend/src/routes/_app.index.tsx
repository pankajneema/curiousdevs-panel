import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Globe, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { getStoredSession, listAgents } from "@/lib/api";
import { useEnvironment } from "@/lib/environment";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { Agent, Environment, RiskBand } from "@/lib/types";

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});

const riskBandClass: Record<RiskBand, string> = {
  low: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  medium: "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
  high: "border-verdict-block/30 bg-verdict-block/10 text-ink",
  critical: "border-verdict-block/50 bg-verdict-block/15 text-ink",
};

const riskOrder: Record<RiskBand, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const environments: Environment[] = ["DEV", "STAGING", "PROD"];

function ComingSoonWidget({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-0">
      <div className="border-b border-rule px-5 py-3">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
      </div>
      <div className="flex flex-col items-center gap-2 border-t-0 px-6 py-10 text-center">
        <p className="max-w-xs text-[12.5px] leading-relaxed text-slate">{description}</p>
      </div>
    </Card>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const session = getStoredSession()!;
  const { environment, setEnvironment } = useEnvironment();
  const { preferences } = usePreferences();
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    listAgents().then(setAgents);
  }, []);

  const kpis = useMemo(() => {
    const all = agents ?? [];
    return {
      total: all.length,
      active: all.filter((a) => a.status === "active").length,
      elevatedRisk: all.filter((a) => a.riskBand === "high" || a.riskBand === "critical").length,
      quarantined: all.filter((a) => a.status === "quarantined").length,
    };
  }, [agents]);

  const needsAttention = kpis.quarantined + kpis.elevatedRisk;

  const topRisks = useMemo(
    () =>
      [...(agents ?? [])]
        .filter((a) => a.status !== "decommissioned")
        .sort((a, b) => riskOrder[a.riskBand] - riskOrder[b.riskBand])
        .slice(0, 5),
    [agents],
  );

  const envHealth = useMemo(
    () =>
      environments.map((env) => {
        const list = agents?.filter((a) => a.environment === env) ?? [];
        const quarantined = list.filter((a) => a.status === "quarantined").length;
        const watchOnly = list.filter((a) => a.status === "watch_only").length;
        const health: "healthy" | "attention" = quarantined > 0 || watchOnly > 0 ? "attention" : "healthy";
        return { env, count: list.length, health, quarantined, watchOnly };
      }),
    [agents],
  );

  const staleAgents = useMemo(
    () =>
      (agents ?? []).filter((a) => {
        if (a.status !== "active" && a.status !== "watch_only") return false;
        if (!a.lastSeenAt) return true;
        const daysSince = (Date.now() - new Date(a.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 30;
      }),
    [agents],
  );
  const watchOnlyAgents = useMemo(() => (agents ?? []).filter((a) => a.status === "watch_only"), [agents]);

  const recommendations: { icon: typeof AlertTriangle; text: string; action: () => void; actionLabel: string }[] = [];
  if (!session.organization.domainVerified) {
    recommendations.push({
      icon: Globe,
      text: `Domain verification is pending for ${session.organization.domain} — agent identity trust is weaker until it's verified.`,
      action: () => navigate({ to: "/settings/organization" }),
      actionLabel: "Verify domain",
    });
  }
  if (watchOnlyAgents.length > 0) {
    recommendations.push({
      icon: AlertTriangle,
      text: `${watchOnlyAgents.length} agent${watchOnlyAgents.length === 1 ? "" : "s"} sitting in Watch-only — review and either promote to Active or decommission.`,
      action: () => navigate({ to: "/agents", search: { status: "watch_only" } }),
      actionLabel: "Review",
    });
  }
  if (staleAgents.length > 0) {
    recommendations.push({
      icon: Sparkles,
      text: `${staleAgents.length} agent${staleAgents.length === 1 ? "" : "s"} with no activity in 30+ days — consider decommissioning.`,
      action: () => navigate({ to: "/agents" }),
      actionLabel: "View agents",
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Welcome, {session.user.name.split(" ")[0]}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-slate">
        {agents === null ? (
          "Loading…"
        ) : needsAttention === 0 ? (
          <>
            <ShieldCheck className="size-[14px] text-verdict-allow" /> All agents healthy across every environment ·{" "}
            {session.organization.name}
          </>
        ) : (
          <>
            <AlertTriangle className="size-[14px] text-verdict-escalate" /> {needsAttention} agent{needsAttention === 1 ? "" : "s"} need
            attention across every environment · {session.organization.name}
          </>
        )}
      </p>

      <div className="mt-6 grid grid-cols-4 gap-5">
        <KpiCard
          label="Total agents"
          value={kpis.total}
          sublabel="across all environments"
          accentClass="border-l-rule"
          active={false}
          onClick={() => navigate({ to: "/agents" })}
        />
        <KpiCard
          label="Active"
          value={kpis.active}
          sublabel="running normally"
          accentClass="border-l-verdict-allow"
          active={false}
          onClick={() => navigate({ to: "/agents", search: { status: "active" } })}
        />
        <KpiCard
          label="Elevated risk"
          value={kpis.elevatedRisk}
          sublabel="high or critical band"
          accentClass="border-l-verdict-block"
          active={false}
          onClick={() => navigate({ to: "/agents", search: { risk: "high,critical" } })}
        />
        <KpiCard
          label="Quarantined"
          value={kpis.quarantined}
          sublabel="needs review"
          accentClass="border-l-verdict-escalate"
          active={false}
          onClick={() => navigate({ to: "/agents", search: { status: "quarantined" } })}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Top risks</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/agents" })}
              className="text-[12px] font-medium text-signal hover:text-signal-deep"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-rule">
            {agents === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
            {agents !== null && topRisks.length === 0 && (
              <p className="px-5 py-6 text-[13px] text-slate">No agents registered yet.</p>
            )}
            {topRisks.map((agent, i) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => navigate({ to: "/agents", search: { q: agent.name } })}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2"
              >
                <span className="font-machine text-[11px] text-slate">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-ink">{agent.name}</span>
                    {agent.hasLethalTrifecta && <AlertTriangle className="size-[12px] shrink-0 text-verdict-block" />}
                  </span>
                </span>
                <span className="font-machine text-[10px] whitespace-nowrap text-slate uppercase">{agent.environment}</span>
                {agent.status === "quarantined" ? (
                  <span className="border border-verdict-block/30 bg-verdict-block/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide text-verdict-block uppercase">
                    Quarantined
                  </span>
                ) : (
                  <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${riskBandClass[agent.riskBand]}`}>
                    {agent.riskBand}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        <ComingSoonWidget
          title="Live decision feed"
          description="Streams every ALLOW / BLOCK / REDACT / ESCALATE verdict as agents make calls. Arrives with the Runtime & Policy Engine (Phase 3) — there's no decision engine to stream from yet."
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-5">
        {envHealth.map(({ env, count, health, quarantined, watchOnly }) => (
          <button
            key={env}
            type="button"
            onClick={() => setEnvironment(env)}
            className={[
              "border p-5 text-left shadow-[var(--shadow-1)]",
              env === environment ? "border-signal bg-signal/5" : "border-rule bg-paper",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-machine text-[11px] whitespace-nowrap text-slate uppercase">{env}</span>
              <span
                className={[
                  "shrink-0 border px-2 py-0.5 font-machine text-[9px] whitespace-nowrap tracking-wide uppercase",
                  health === "healthy" ? "border-verdict-allow/30 bg-verdict-allow/10 text-ink" : "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
                ].join(" ")}
              >
                {health === "healthy" ? "Healthy" : "Needs attention"}
              </span>
            </div>
            <p className="mt-2 text-[20px] font-bold text-ink">{count}</p>
            <p className="mt-0.5 text-[11.5px] whitespace-nowrap text-slate">
              {quarantined > 0 ? `${quarantined} quarantined` : watchOnly > 0 ? `${watchOnly} watch-only` : "agents"}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Recent activity</p>
          </div>
          <div className="divide-y divide-rule">
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[13px] text-ink">
                {session.user.name} signed in
              </p>
              <p className="text-[12px] text-slate">
                {session.user.lastActiveAt ? formatDate(session.user.lastActiveAt, preferences) : "—"}
              </p>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[13px] text-ink">Organization created</p>
              <p className="text-[12px] text-slate">{formatDate(session.organization.createdAt, preferences)}</p>
            </div>
          </div>
          <p className="border-t border-rule px-5 py-3 text-[12px] text-slate">
            A full org-wide audit timeline (invites, role changes, integration status, danger-zone actions)
            arrives with the Audit Center (Phase 6).
          </p>
        </Card>

        <Card className="p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Recommendations</p>
          </div>
          <div className="divide-y divide-rule">
            {recommendations.length === 0 && (
              <p className="px-5 py-6 text-[13px] text-slate">Nothing needs your attention right now.</p>
            )}
            {recommendations.map((rec, i) => {
              const Icon = rec.icon;
              return (
                <div key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 size-[14px] shrink-0 text-verdict-escalate" />
                    <p className="text-[12.5px] leading-relaxed text-ink">{rec.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={rec.action}
                    className="shrink-0 text-[12px] font-medium text-signal hover:text-signal-deep"
                  >
                    {rec.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
