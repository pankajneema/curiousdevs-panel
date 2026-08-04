import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Eye,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  AgentFormModal,
  agentToFormValues,
  emptyFormValues,
  environments,
  riskBands,
} from "@/components/agents/AgentForm";
import { AgentStatusActions } from "@/components/agents/AgentStatusActions";
import { ApiError, createAgent, listAgents, listTeam, updateAgent, updateAgentStatus } from "@/lib/api";
import { isConnected, riskBandClass, statusClass, statusLabel } from "@/lib/agentDisplay";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { Agent, AgentStatus, Environment, RiskBand, User } from "@/lib/types";

interface AgentsSearch {
  status?: string | undefined;
  risk?: string | undefined;
  q?: string | undefined;
}

export const Route = createFileRoute("/_app/agents")({
  validateSearch: (search: Record<string, unknown>): AgentsSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
    risk: typeof search.risk === "string" ? search.risk : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: AgentsPage,
});

const statuses: AgentStatus[] = ["active", "watch_only", "quarantined", "decommissioned"];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FilterDropdown<T extends string>({
  label,
  options,
  optionLabel,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  optionLabel: (opt: T) => string;
  selected: T[];
  onToggle: (opt: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={[
          "flex items-center gap-1.5 border px-2.5 py-1.5 font-machine text-[11px] tracking-wide uppercase",
          selected.length > 0 ? "border-signal bg-signal/10 text-signal" : "border-rule text-slate hover:text-ink",
        ].join(" ")}
      >
        {label}
        {selected.length > 0 && <span>({selected.length})</span>}
        <ChevronDown className={`size-[12px] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1.5 w-52 border border-rule bg-paper shadow-[var(--shadow-2)]">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
            >
              <span
                className={[
                  "flex size-4 shrink-0 items-center justify-center border",
                  selected.includes(opt) ? "border-signal bg-signal" : "border-rule bg-paper",
                ].join(" ")}
              >
                {selected.includes(opt) && <Check className="size-[11px] text-paper" strokeWidth={3} />}
              </span>
              <span className="text-[13px] text-ink">{optionLabel(opt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentDrawer({
  agent,
  members,
  onClose,
  onStatusChange,
  onEdit,
}: {
  agent: Agent;
  members: User[];
  onClose: () => void;
  onStatusChange: (status: AgentStatus) => Promise<void>;
  onEdit: () => void;
}) {
  const { preferences } = usePreferences();
  const owner = members.find((m) => m.id === agent.ownerUserId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-[620px] flex-col border-l border-rule bg-paper shadow-[var(--shadow-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold text-ink">{agent.name}</p>
              {agent.hasLethalTrifecta && (
                <AlertTriangle
                  className="size-[14px] text-verdict-block"
                  aria-label="Has the lethal trifecta"
                />
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-slate">{agent.purpose}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to="/agents/$agentId"
              params={{ agentId: agent.id }}
              className="flex items-center gap-1 text-[12.5px] font-medium text-signal hover:text-signal-deep"
            >
              Full profile <ArrowUpRight className="size-[12px]" />
            </Link>
            <button type="button" onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Environment</dt>
              <dd className="mt-0.5 font-machine text-ink">{agent.environment}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Connection</dt>
              <dd className="mt-0.5 font-machine text-ink">{agent.connectionMethods.join(", ")}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Risk band</dt>
              <dd className="mt-0.5">
                <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${riskBandClass[agent.riskBand]}`}>
                  {agent.riskBand}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Status</dt>
              <dd className="mt-0.5">
                <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[agent.status]}`}>
                  {statusLabel[agent.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Connection status</dt>
              <dd className="mt-0.5">
                {isConnected(agent) ? (
                  <span className="border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap uppercase tracking-wide text-ink">
                    Connected
                  </span>
                ) : (
                  <span className="border border-verdict-escalate/30 bg-verdict-escalate/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap uppercase tracking-wide text-ink">
                    Awaiting connection
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Owner</dt>
              <dd className="mt-0.5 text-ink">{owner?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Calls (24h)</dt>
              <dd className="mt-0.5 font-machine text-ink">{agent.callVolume24h.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Created</dt>
              <dd className="mt-0.5 text-ink">{formatDate(agent.createdAt, preferences)}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Last seen</dt>
              <dd className="mt-0.5 text-ink">{agent.lastSeenAt ? formatDate(agent.lastSeenAt, preferences) : "Never"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Agent version</dt>
              <dd className="mt-0.5 truncate font-machine text-[11.5px] text-ink">{agent.agentVersion}</dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-rule px-5 py-4">
          <p className="mb-2 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Actions</p>
          <AgentStatusActions agent={agent} onEdit={onEdit} onStatusChange={onStatusChange} />
        </div>
      </div>
    </div>
  );
}

function AgentsPage() {
  const searchParams = Route.useSearch();
  const { preferences } = usePreferences();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState(searchParams.q ?? "");
  const [environmentFilters, setEnvironmentFilters] = useState<Environment[]>([]);
  const [statusFilters, setStatusFilters] = useState<AgentStatus[]>(
    (searchParams.status?.split(",").filter((s): s is AgentStatus => statuses.includes(s as AgentStatus)) ?? []),
  );
  const [riskFilters, setRiskFilters] = useState<RiskBand[]>(
    (searchParams.risk?.split(",").filter((r): r is RiskBand => riskBands.includes(r as RiskBand)) ?? []),
  );
  const [trifectaOnly, setTrifectaOnly] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [agentList, { members }] = await Promise.all([listAgents(), listTeam()]);
    setAgents(agentList);
    setMembers(members);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (agents ?? []).filter((a) => {
      if (q && !`${a.name} ${a.purpose}`.toLowerCase().includes(q)) return false;
      if (environmentFilters.length > 0 && !environmentFilters.includes(a.environment)) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(a.status)) return false;
      if (riskFilters.length > 0 && !riskFilters.includes(a.riskBand)) return false;
      if (trifectaOnly && !a.hasLethalTrifecta) return false;
      return true;
    });
  }, [agents, search, environmentFilters, statusFilters, riskFilters, trifectaOnly]);

  const kpis = useMemo(() => {
    const scope = agents ?? [];
    return {
      total: scope.length,
      active: scope.filter((a) => a.status === "active").length,
      elevatedRisk: scope.filter((a) => a.riskBand === "high" || a.riskBand === "critical").length,
      quarantined: scope.filter((a) => a.status === "quarantined").length,
    };
  }, [agents]);

  function toggleEnvironmentFilter(e: Environment) {
    setEnvironmentFilters((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }
  function toggleStatusFilter(s: AgentStatus) {
    setStatusFilters((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function toggleRiskFilter(r: RiskBand) {
    setRiskFilters((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }
  function clearFilters() {
    setSearch("");
    setEnvironmentFilters([]);
    setStatusFilters([]);
    setRiskFilters([]);
    setTrifectaOnly(false);
  }

  const viewingAgent = agents?.find((a) => a.id === viewingId) ?? null;
  const editingAgent = agents?.find((a) => a.id === editingId) ?? null;

  async function handleStatusChange(agentId: string, status: AgentStatus) {
    const updated = await updateAgentStatus(agentId, status);
    setAgents((prev) => (prev ? prev.map((a) => (a.id === agentId ? updated : a)) : prev));
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Agent Inventory</h1>
          <p className="mt-1 text-[13.5px] text-slate">
            Every agent with runtime access across every environment, and how risky that access is.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-[14px]" /> Register agent
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-4 gap-5">
        <KpiCard
          label="Total agents"
          value={kpis.total}
          sublabel="across all environments"
          accentClass="border-l-rule"
          active={environmentFilters.length === 0 && statusFilters.length === 0 && riskFilters.length === 0 && !trifectaOnly}
          onClick={clearFilters}
        />
        <KpiCard
          label="Active"
          value={kpis.active}
          sublabel="running normally"
          accentClass="border-l-verdict-allow"
          active={statusFilters.length === 1 && statusFilters[0] === "active"}
          onClick={() => setStatusFilters(["active"])}
        />
        <KpiCard
          label="Elevated risk"
          value={kpis.elevatedRisk}
          sublabel="high or critical band"
          accentClass="border-l-verdict-block"
          active={riskFilters.length === 2 && riskFilters.includes("high") && riskFilters.includes("critical")}
          onClick={() => setRiskFilters(["high", "critical"])}
        />
        <KpiCard
          label="Quarantined"
          value={kpis.quarantined}
          sublabel="needs review"
          accentClass="border-l-verdict-escalate"
          active={statusFilters.length === 1 && statusFilters[0] === "quarantined"}
          onClick={() => setStatusFilters(["quarantined"])}
        />
      </div>

      <Card className="mt-6 p-0">
        <div className="flex flex-col gap-3 border-b border-rule px-5 py-4">
          <Input
            placeholder="Search agents by name or purpose…"
            icon={<Search className="size-[15px]" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="Environment"
              options={environments}
              optionLabel={(e) => e}
              selected={environmentFilters}
              onToggle={toggleEnvironmentFilter}
            />
            <FilterDropdown
              label="Status"
              options={statuses}
              optionLabel={(s) => statusLabel[s]}
              selected={statusFilters}
              onToggle={toggleStatusFilter}
            />
            <FilterDropdown
              label="Risk"
              options={riskBands}
              optionLabel={(r) => r}
              selected={riskFilters}
              onToggle={toggleRiskFilter}
            />
            <button
              type="button"
              onClick={() => setTrifectaOnly((v) => !v)}
              className={[
                "flex items-center gap-1.5 border px-2.5 py-1.5 font-machine text-[11px] tracking-wide uppercase",
                trifectaOnly ? "border-signal bg-signal/10 text-signal" : "border-rule text-slate hover:text-ink",
              ].join(" ")}
            >
              <AlertTriangle className="size-[12px]" /> Trifecta exposure
            </button>
            {(search ||
              environmentFilters.length > 0 ||
              statusFilters.length > 0 ||
              riskFilters.length > 0 ||
              trifectaOnly) && (
              <button type="button" onClick={clearFilters} className="ml-auto text-[12px] font-medium text-slate hover:text-ink">
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Agent</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Env</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Risk</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Calls (24h)</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Connection status</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Owner</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents === null && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-[13px] text-slate">
                    Loading agents…
                  </td>
                </tr>
              )}
              {agents !== null && agents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-slate">
                    No agents registered yet. Register one to get started.
                  </td>
                </tr>
              )}
              {agents !== null && agents.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-slate">
                    No agents match these filters.{" "}
                    <button type="button" onClick={clearFilters} className="font-medium text-signal hover:text-signal-deep">
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
              {filtered.map((agent) => {
                const owner = members.find((m) => m.id === agent.ownerUserId);
                const connected = isConnected(agent);
                return (
                  <tr key={agent.id} className="border-b border-rule last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => setViewingId(agent.id)} className="flex items-center gap-3 text-left">
                        <span className="flex size-8 shrink-0 items-center justify-center bg-surface-2 text-slate">
                          <Bot className="size-[15px]" />
                        </span>
                        <div className="min-w-0 max-w-[200px]">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13.5px] font-semibold text-ink">{agent.name}</span>
                            {agent.hasLethalTrifecta && (
                              <AlertTriangle className="size-[13px] shrink-0 text-verdict-block" aria-label="Has the lethal trifecta" />
                            )}
                          </span>
                          <span className="block truncate text-[12px] text-slate" title={agent.purpose}>
                            {agent.purpose}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3 font-machine text-[11px] whitespace-nowrap text-slate uppercase">{agent.environment}</td>
                    <td className="px-3 py-3">
                      <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${riskBandClass[agent.riskBand]}`}>
                        {agent.riskBand}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[agent.status]}`}>
                        {statusLabel[agent.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-machine text-[12.5px] whitespace-nowrap text-ink tabular-nums">
                      {agent.callVolume24h.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      {connected ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase text-ink">
                            Connected
                          </span>
                          <span className="text-[11px] whitespace-nowrap text-slate">{formatDate(agent.lastSeenAt!, preferences)}</span>
                        </span>
                      ) : (
                        <span className="border border-verdict-escalate/30 bg-verdict-escalate/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase text-ink">
                          Awaiting connection
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {owner ? (
                        <span className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center bg-surface-2 font-mono text-[9px] font-semibold text-ink">
                            {initials(owner.name)}
                          </span>
                          <span className="truncate text-[12.5px] text-ink">{owner.name}</span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-slate">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingId(agent.id)}
                          className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                        >
                          <Eye className="size-[12px]" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(agent.id)}
                          className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                        >
                          <Pencil className="size-[12px]" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {viewingAgent && (
        <AgentDrawer
          agent={viewingAgent}
          members={members}
          onClose={() => setViewingId(null)}
          onEdit={() => {
            setEditingId(viewingAgent.id);
            setViewingId(null);
          }}
          onStatusChange={async (status) => {
            try {
              await handleStatusChange(viewingAgent.id, status);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't update this agent. Try again.");
            }
          }}
        />
      )}

      {creating && (
        <AgentFormModal
          title="Register agent"
          members={members}
          initialValues={emptyFormValues(environmentFilters[0] ?? "PROD", members[0]?.id ?? "")}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const created = await createAgent({
              ...values,
              expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
            });
            setAgents((prev) => (prev ? [...prev, created] : [created]));
            setCreating(false);
          }}
        />
      )}

      {editingAgent && (
        <AgentFormModal
          title={`Edit ${editingAgent.name}`}
          members={members}
          initialValues={agentToFormValues(editingAgent)}
          onClose={() => setEditingId(null)}
          onSubmit={async (values) => {
            const updated = await updateAgent(editingAgent.id, {
              ...values,
              expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
            });
            setAgents((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev));
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
