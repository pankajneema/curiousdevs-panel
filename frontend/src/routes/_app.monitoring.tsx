import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { getMonitoringOverview } from "@/lib/api";
import { statusClass, statusLabel } from "@/lib/agentDisplay";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { MonitoringOverview } from "@/lib/types";

export const Route = createFileRoute("/_app/monitoring")({
  component: MonitoringPage,
});

function HourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
}

function HourlyChart({ buckets }: { buckets: MonitoringOverview["hourlyBuckets"] }) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-slate">
        No calls reported in the last 24h.
      </div>
    );
  }
  const max = Math.max(...buckets.map((b) => b.callCount), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {buckets.map((bucket) => (
        <div key={bucket.hourStart} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className="w-full bg-signal/70 transition-colors group-hover:bg-signal"
            style={{ height: `${Math.max((bucket.callCount / max) * 100, bucket.callCount > 0 ? 4 : 0)}%` }}
          />
          <div className="pointer-events-none absolute bottom-full mb-1.5 hidden whitespace-nowrap border border-rule bg-paper px-2 py-1 font-machine text-[10px] text-ink shadow-[var(--shadow-1)] group-hover:block">
            {bucket.callCount.toLocaleString()} calls · {HourLabel(bucket.hourStart)}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonitoringPage() {
  const { preferences } = usePreferences();
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);

  useEffect(() => {
    getMonitoringOverview().then(setOverview);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Monitoring</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-slate">
        Real call volume, computed only from what agents have actually reported via{" "}
        <code className="font-machine text-[12px]">POST /agents/:id/activity</code> — an agent that never reports
        shows 0, not an estimate. Verdict split, latency against a budget, and alerting aren't built yet: those
        need a real decision engine, which doesn't exist yet either.
      </p>

      {overview === null ? (
        <p className="mt-6 text-[13px] text-slate">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <KpiCard
              label="Total calls"
              value={overview.totalCalls24h}
              sublabel="last 24 hours"
              accentClass="border-l-rule"
              active={false}
              onClick={() => {}}
            />
            <KpiCard
              label="Active agents"
              value={overview.activeAgents24h}
              sublabel="reported a call in 24h"
              accentClass="border-l-verdict-allow"
              active={false}
              onClick={() => {}}
            />
            <KpiCard
              label="Idle agents"
              value={overview.idleAgents}
              sublabel="no calls reported in 24h"
              accentClass="border-l-verdict-escalate"
              active={false}
              onClick={() => {}}
            />
          </div>

          <Card className="mt-6 p-5">
            <p className="text-[13px] font-semibold text-ink">Calls per hour</p>
            <p className="mt-1 text-[12px] text-slate">Last 24 hours, org-wide.</p>
            <div className="mt-5">
              <HourlyChart buckets={overview.hourlyBuckets} />
            </div>
          </Card>

          <Card className="mt-5 p-0">
            <div className="border-b border-rule px-5 py-3.5">
              <p className="text-[13px] font-semibold text-ink">By agent</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-rule">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Agent</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Env</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Calls (24h)</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {overview.agents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-slate">
                      No agents yet.
                    </td>
                  </tr>
                )}
                {overview.agents.map((row) => (
                  <tr key={row.agentId} className="border-b border-rule last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <Link
                        to="/agents/$agentId"
                        params={{ agentId: row.agentId }}
                        className="flex items-center gap-2 text-[13px] font-medium text-ink hover:text-signal"
                      >
                        <Activity className="size-[13px] text-slate" />
                        {row.agentName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-machine text-[11px] whitespace-nowrap text-slate uppercase">
                      {row.environment}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[row.status]}`}
                      >
                        {statusLabel[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-machine text-[12.5px] whitespace-nowrap text-ink tabular-nums">
                      {row.callVolume24h.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] whitespace-nowrap text-slate">
                      {row.lastSeenAt ? formatDate(row.lastSeenAt, preferences) : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
