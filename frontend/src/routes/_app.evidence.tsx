import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Building2, FileClock, Mail, Search, Server, SlidersHorizontal, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { listAuditLog } from "@/lib/api";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { AuditLogEntry } from "@/lib/types";

export const Route = createFileRoute("/_app/evidence")({
  component: EvidencePage,
});

const targetTypes = ["agent", "policy", "mcp_server", "invitation", "user", "group", "organization"] as const;
type TargetType = (typeof targetTypes)[number];

const targetTypeLabel: Record<TargetType, string> = {
  agent: "Agents",
  policy: "Policies",
  mcp_server: "MCP servers",
  invitation: "Invitations",
  user: "Team members",
  group: "Groups",
  organization: "Organization",
};

const targetTypeIcon: Record<TargetType, typeof Bot> = {
  agent: Bot,
  policy: SlidersHorizontal,
  mcp_server: Server,
  invitation: Mail,
  user: Users,
  group: Users,
  organization: Building2,
};

function EvidencePage() {
  const { preferences } = usePreferences();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState<TargetType | "">("");

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      const result = await listAuditLog({
        q: search.trim() || undefined,
        targetType: targetType || undefined,
      });
      if (!cancelled) setEntries(result);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search, targetType]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Evidence</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-slate">
        A real, permanent record of every change made in this console — who did what, and when. Tamper-evident
        agent session replay, SOC 2 / ISO 27001 / DPDP compliance exports, and legal hold aren't built yet — those
        need a live agent runtime feeding this system, which doesn't exist yet either.
      </p>

      <Card className="mt-6 p-0">
        <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search the audit log…"
            icon={<Search className="size-[15px]" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as TargetType | "")}
            className="h-11 shrink-0 border border-rule bg-paper px-3.5 text-[14px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30 sm:w-52"
          >
            <option value="">All resource types</option>
            {targetTypes.map((t) => (
              <option key={t} value={t}>
                {targetTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        {entries === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}

        {entries !== null && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <FileClock className="size-[18px] text-slate" />
            <p className="text-[13px] text-slate">
              {search || targetType ? "Nothing matches these filters." : "No activity recorded yet."}
            </p>
          </div>
        )}

        {entries !== null && entries.length > 0 && (
          <ul>
            {entries.map((entry) => {
              const Icon = targetTypeIcon[entry.targetType as TargetType] ?? FileClock;
              return (
                <li key={entry.id} className="flex items-start gap-3 border-b border-rule px-5 py-3 last:border-0">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center bg-surface-2 text-slate">
                    <Icon className="size-[14px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-ink">{entry.summary}</p>
                    <p className="mt-0.5 text-[12px] text-slate">
                      {entry.actorName} · {formatDate(entry.createdAt, preferences)}
                    </p>
                  </div>
                  <span className="mt-0.5 shrink-0 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">
                    {entry.action}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
