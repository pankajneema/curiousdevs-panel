import { Radio } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePreferences } from "@/lib/preferences";
import type { Agent } from "@/lib/types";

const riskBandClass: Record<Agent["riskBand"], string> = {
  low: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  medium: "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
  high: "border-verdict-block/30 bg-verdict-block/10 text-ink",
  critical: "border-verdict-block/50 bg-verdict-block/15 text-ink",
};

export function AgentList({ agents, environment }: { agents: Agent[] | null; environment: string }) {
  const { preferences } = usePreferences();
  const filtered = agents?.filter((a) => a.environment === environment) ?? null;
  const rowPadding = preferences.density === "compact" ? "py-2" : "py-3.5";
  const iconSize = preferences.density === "compact" ? "size-6" : "size-8";

  return (
    <Card className="p-0">
      <div className="border-b border-rule px-5 py-3">
        <p className="text-[13px] font-semibold text-ink">Agents</p>
      </div>
      <div className="divide-y divide-rule">
        {filtered === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
        {filtered?.length === 0 && (
          <p className="px-5 py-6 text-[13px] text-slate">
            No agents connected in {environment}. Switch environments above, or connect one to get started.
          </p>
        )}
        {filtered?.map((agent) => (
          <div key={agent.id} className={`flex items-center justify-between gap-4 px-5 ${rowPadding}`}>
            <div className="flex items-center gap-3">
              <span className={`flex ${iconSize} items-center justify-center bg-surface-2 text-slate`}>
                <Radio className="size-[15px]" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">{agent.name}</p>
                {preferences.density !== "compact" && (
                  <p className="text-[12px] text-slate">{agent.purpose}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-machine text-[11px] text-slate uppercase">{agent.environment}</span>
              <span
                className={`rounded-[var(--radius-chip)] border px-2 py-0.5 font-machine text-[10px] tracking-wide uppercase ${riskBandClass[agent.riskBand]}`}
              >
                {agent.riskBand} risk
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
