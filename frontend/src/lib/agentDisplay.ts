import type { Agent, AgentStatus, RiskBand } from "./types";

export const riskBandClass: Record<RiskBand, string> = {
  low: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  medium: "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
  high: "border-verdict-block/30 bg-verdict-block/10 text-ink",
  critical: "border-verdict-block/50 bg-verdict-block/15 text-ink",
};

export const statusClass: Record<AgentStatus, string> = {
  active: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  watch_only: "border-verdict-sandbox/30 bg-verdict-sandbox/10 text-ink",
  quarantined: "border-verdict-block/30 bg-verdict-block/10 text-verdict-block",
  decommissioned: "border-rule text-slate",
};

export const statusLabel: Record<AgentStatus, string> = {
  active: "Active",
  watch_only: "Watch-only",
  quarantined: "Quarantined",
  decommissioned: "Decommissioned",
};

/** Whether the agent's real runtime has ever actually checked in — distinct
 * from its administrative status. A freshly registered agent is honestly
 * "Awaiting connection" until its own SDK/MCP handshake reports back, not
 * silently shown as connected just because it was added to the registry. */
export function isConnected(agent: Agent): boolean {
  return agent.lastSeenAt !== null;
}
