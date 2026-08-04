import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bot, Check, Copy, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Checkbox } from "@/components/ui/Checkbox";
import { AgentFormModal, agentToFormValues } from "@/components/agents/AgentForm";
import { AgentStatusActions } from "@/components/agents/AgentStatusActions";
import {
  ApiError,
  getAgent,
  getAgentMcpServers,
  getAgentPolicies,
  listPolicies,
  listTeam,
  setAgentPolicies,
  updateAgent,
  updateAgentStatus,
} from "@/lib/api";
import { API_BASE_URL } from "@/lib/apiClient";
import { isConnected, riskBandClass, statusClass, statusLabel } from "@/lib/agentDisplay";
import { mcpStatusClass, mcpStatusLabel } from "@/lib/mcpServerDisplay";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { Agent, ConnectionMethod, McpServer, Policy, User } from "@/lib/types";

export const Route = createFileRoute("/_app/agents_/$agentId")({
  component: AgentDetailsPage,
});

const comingSoonSections = [
  {
    title: "Identity",
    description:
      "The credential this agent authenticates with, its key rotation history, and where it's been issued to.",
  },
  {
    title: "Permissions",
    description:
      "The exact tools, data scopes, and actions this agent is allowed to touch — enforced, not just documented.",
  },
  {
    title: "Approvals",
    description:
      "A record of the human sign-offs this agent has needed, and who granted them, for actions above its normal authority.",
  },
];

const setupSnippets: Record<ConnectionMethod, { label: string; code: (agentId: string) => string }> = {
  mcp: {
    label: "MCP",
    code: (agentId) =>
      `{\n  "mcpServers": {\n    "agentguard": {\n      "url": "${API_BASE_URL}/mcp",\n      "headers": { "Authorization": "Bearer <AGENTGUARD_API_KEY>" },\n      "agentId": "${agentId}"\n    }\n  }\n}`,
  },
  python_sdk: {
    label: "Python SDK",
    code: (agentId) =>
      `from agentguard import AgentGuard\n\nguard = AgentGuard(\n    api_key="<AGENTGUARD_API_KEY>",\n    agent_id="${agentId}",\n    base_url="${API_BASE_URL}",\n)`,
  },
  typescript_sdk: {
    label: "TypeScript SDK",
    code: (agentId) =>
      `import { AgentGuard } from "@agentguard/sdk";\n\nconst guard = new AgentGuard({\n  apiKey: "<AGENTGUARD_API_KEY>",\n  agentId: "${agentId}",\n  baseUrl: "${API_BASE_URL}",\n});`,
  },
  proxy: {
    label: "Proxy",
    code: (agentId) =>
      `export AGENTGUARD_PROXY_URL="${API_BASE_URL}/proxy"\nexport AGENTGUARD_API_KEY="<AGENTGUARD_API_KEY>"\nexport AGENTGUARD_AGENT_ID="${agentId}"`,
  },
};

function reportSnippet(agentId: string): string {
  const config = JSON.stringify({
    mcpServers: { filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] } },
  });
  return [
    `curl -X POST ${API_BASE_URL}/agents/${agentId}/report \\`,
    `  -H "Authorization: Bearer <AGENTGUARD_API_KEY>" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify({ agentVersion: "1.0.0", mcpServersConfig: config })}'`,
  ].join("\n");
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto border border-rule bg-surface-2 px-3.5 py-3 font-machine text-[11.5px] leading-relaxed text-ink">
        {code}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy"
        className="absolute top-2 right-2 flex size-7 items-center justify-center border border-rule bg-paper text-slate hover:text-ink"
      >
        {copied ? <Check className="size-[13px] text-verdict-allow" /> : <Copy className="size-[13px]" />}
      </button>
    </div>
  );
}

function PolicyPickerModal({
  allPolicies,
  attachedIds,
  onClose,
  onSave,
}: {
  allPolicies: Policy[];
  attachedIds: string[];
  onClose: () => void;
  onSave: (policyIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(attachedIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update policies. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Manage policies"
      subtitle="Pick which policies apply to this agent."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      {allPolicies.length === 0 ? (
        <p className="text-[13px] text-slate">
          No policies exist yet. Create one on the{" "}
          <Link to="/policies" className="font-medium text-signal hover:text-signal-deep">
            Policies
          </Link>{" "}
          page first.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {allPolicies.map((policy) => (
            <Checkbox
              key={policy.id}
              id={`policy-${policy.id}`}
              label={`${policy.name} (${policy.status})`}
              checked={selected.includes(policy.id)}
              onChange={() => toggle(policy.id)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function AgentDetailsPage() {
  const { agentId } = Route.useParams();
  const { preferences } = usePreferences();
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined);
  const [members, setMembers] = useState<User[]>([]);
  const [attachedPolicies, setAttachedPolicies] = useState<Policy[]>([]);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [linkedMcpServers, setLinkedMcpServers] = useState<McpServer[]>([]);
  const [editing, setEditing] = useState(false);
  const [managingPolicies, setManagingPolicies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [fetchedAgent, { members }, policies, orgPolicies, mcpServers] = await Promise.all([
        getAgent(agentId),
        listTeam(),
        getAgentPolicies(agentId),
        listPolicies(),
        getAgentMcpServers(agentId),
      ]);
      setAgent(fetchedAgent);
      setMembers(members);
      setAttachedPolicies(policies);
      setAllPolicies(orgPolicies);
      setLinkedMcpServers(mcpServers);
    } catch {
      setAgent(null);
    }
  }

  useEffect(() => {
    refresh();
  }, [agentId]);

  async function handleStatusChange(status: Agent["status"]) {
    if (!agent) return;
    try {
      const updated = await updateAgentStatus(agent.id, status);
      setAgent(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update this agent. Try again.");
    }
  }

  if (agent === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <p className="text-[13px] text-slate">Loading agent…</p>
      </div>
    );
  }

  if (agent === null) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <Link to="/agents" className="flex items-center gap-1.5 text-[13px] font-medium text-slate hover:text-ink">
          <ArrowLeft className="size-[13px]" /> Agents
        </Link>
        <div className="mt-8 flex flex-col items-center gap-2 border border-dashed border-rule px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-ink">Agent not found</p>
          <p className="max-w-md text-[13px] text-slate">
            It may have been decommissioned and removed, or the link is wrong.
          </p>
        </div>
      </div>
    );
  }

  const owner = members.find((m) => m.id === agent.ownerUserId);
  const connected = isConnected(agent);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <Link to="/agents" className="flex items-center gap-1.5 text-[13px] font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-[13px]" /> Agents
      </Link>

      {error && (
        <p role="alert" className="mt-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-5 border-b border-rule pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center bg-surface-2 text-slate">
            <Bot className="size-[22px]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink">{agent.name}</h1>
              {agent.hasLethalTrifecta && (
                <AlertTriangle className="size-[16px] text-verdict-block" aria-label="Has the lethal trifecta" />
              )}
            </div>
            <p className="mt-1 max-w-xl text-[13.5px] text-slate">{agent.purpose}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${riskBandClass[agent.riskBand]}`}>
                {agent.riskBand} risk
              </span>
              <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[agent.status]}`}>
                {statusLabel[agent.status]}
              </span>
              <span className="border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap uppercase tracking-wide text-ink border-rule">
                {agent.environment}
              </span>
              {connected ? (
                <span className="border border-verdict-allow/30 bg-verdict-allow/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap uppercase tracking-wide text-ink">
                  Connected
                </span>
              ) : (
                <span className="border border-verdict-escalate/30 bg-verdict-escalate/10 px-2 py-0.5 font-machine text-[10px] whitespace-nowrap uppercase tracking-wide text-ink">
                  Awaiting connection
                </span>
              )}
            </div>
          </div>
        </div>
        <AgentStatusActions agent={agent} onEdit={() => setEditing(true)} onStatusChange={handleStatusChange} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-[13px] font-semibold text-ink">Overview</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-[13px]">
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Connection methods</dt>
              <dd className="mt-1 font-machine text-ink">{agent.connectionMethods.join(", ")}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Owner</dt>
              <dd className="mt-1 text-ink">{owner?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Calls (24h)</dt>
              <dd className="mt-1 font-machine text-ink tabular-nums">{agent.callVolume24h.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Last seen</dt>
              <dd className="mt-1 text-ink">{agent.lastSeenAt ? formatDate(agent.lastSeenAt, preferences) : "Never"}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Created</dt>
              <dd className="mt-1 text-ink">{formatDate(agent.createdAt, preferences)}</dd>
            </div>
            <div>
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Expires</dt>
              <dd className="mt-1 text-ink">{agent.expiresAt ? formatDate(agent.expiresAt, preferences) : "Never"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Agent version</dt>
              <dd className="mt-1 font-machine text-[12px] text-ink">{agent.agentVersion}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink">Risk assessment</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
            Set from manual review — AgentGuard doesn't yet auto-score risk from a live policy engine.
          </p>
          {agent.hasLethalTrifecta && (
            <div className="mt-4 flex items-start gap-2 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-[14px] shrink-0 text-verdict-block" />
              <p className="text-[12px] leading-relaxed text-ink">
                Has the lethal trifecta: private data access, untrusted content exposure, and external
                communication, all at once.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-[13px] font-semibold text-ink">Setup</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
            How to connect this agent over the surfaces it's registered for. Swap in a real key from{" "}
            <Link to="/developer" className="font-medium text-signal hover:text-signal-deep">
              Developer → API keys
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {agent.connectionMethods.map((method) => (
              <div key={method}>
                <p className="mb-1.5 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">
                  {setupSnippets[method].label}
                </p>
                <CodeBlock code={setupSnippets[method].code(agent.id)} />
              </div>
            ))}
            <div className="border-t border-rule pt-4">
              <p className="mb-1.5 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Reporting in</p>
              <p className="mb-1.5 text-[12px] text-slate">
                What a real SDK calls on init — this is the actual request that flips this agent to Connected and
                fills in the MCP servers card below, no manual entry needed.
              </p>
              <CodeBlock code={reportSnippet(agent.id)} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">Policies</p>
            <button
              type="button"
              onClick={() => setManagingPolicies(true)}
              className="flex items-center gap-1 text-[12px] font-medium text-signal hover:text-signal-deep"
            >
              <SlidersHorizontal className="size-[12px]" /> Manage
            </button>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
            Organizational intent attached to this agent — not yet a live, enforced rule.
          </p>
          {attachedPolicies.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-slate">No policies attached.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {attachedPolicies.map((policy) => (
                <li key={policy.id} className="flex items-center justify-between gap-2 border border-rule px-3 py-2">
                  <span className="truncate text-[12.5px] text-ink">{policy.name}</span>
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-machine text-[9.5px] uppercase tracking-wide ${
                      policy.status === "active"
                        ? "border-verdict-allow/30 bg-verdict-allow/10 text-ink"
                        : "border-rule text-slate"
                    }`}
                  >
                    {policy.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <p className="text-[13px] font-semibold text-ink">MCP servers</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
          Reported automatically by this agent on check-in — not manually managed. Empty until the agent's own
          SDK calls the report endpoint above at least once.
        </p>
        {linkedMcpServers.length === 0 ? (
          <p className="mt-4 text-[12.5px] text-slate">None reported yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {linkedMcpServers.map((server) => (
              <li key={server.id} className="flex items-center justify-between gap-2 border border-rule px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-ink">{server.name}</p>
                  <p
                    className="truncate font-machine text-[10.5px] text-slate"
                    title={server.transport === "http" ? (server.endpoint ?? "") : [server.command, ...server.args].join(" ")}
                  >
                    {server.transport === "http" ? server.endpoint : [server.command, ...server.args].join(" ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 font-machine text-[9.5px] uppercase tracking-wide ${mcpStatusClass[server.status]}`}
                >
                  {mcpStatusLabel[server.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {comingSoonSections.map((section) => (
          <div key={section.title} className="border border-dashed border-rule px-5 py-6">
            <p className="text-[12.5px] font-semibold text-ink">{section.title}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate">{section.description}</p>
            <p className="mt-3 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Coming soon</p>
          </div>
        ))}
      </div>

      {editing && (
        <AgentFormModal
          title={`Edit ${agent.name}`}
          members={members}
          initialValues={agentToFormValues(agent)}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            const updated = await updateAgent(agent.id, {
              ...values,
              expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
            });
            setAgent(updated);
            setEditing(false);
          }}
        />
      )}

      {managingPolicies && (
        <PolicyPickerModal
          allPolicies={allPolicies}
          attachedIds={attachedPolicies.map((p) => p.id)}
          onClose={() => setManagingPolicies(false)}
          onSave={async (policyIds) => {
            const updated = await setAgentPolicies(agent.id, policyIds);
            setAttachedPolicies(updated);
            setManagingPolicies(false);
          }}
        />
      )}
    </div>
  );
}
