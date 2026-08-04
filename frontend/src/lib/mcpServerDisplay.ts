import type { McpServerStatus } from "./types";

export const mcpStatusClass: Record<McpServerStatus, string> = {
  reachable: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  unreachable: "border-verdict-block/30 bg-verdict-block/10 text-verdict-block",
  pending: "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
  local: "border-rule text-slate",
};

export const mcpStatusLabel: Record<McpServerStatus, string> = {
  reachable: "Reachable",
  unreachable: "Unreachable",
  pending: "Checking…",
  local: "Local",
};
