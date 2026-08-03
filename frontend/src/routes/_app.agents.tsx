import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgentList } from "@/components/agents/AgentList";
import { listAgents } from "@/lib/api";
import { useEnvironment } from "@/lib/environment";
import type { Agent } from "@/lib/types";

export const Route = createFileRoute("/_app/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const { environment } = useEnvironment();
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    listAgents().then(setAgents);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Agents</h1>
      <p className="mt-1 text-[13.5px] text-slate">Every agent connected to this organization.</p>

      <div className="mt-8">
        <AgentList agents={agents} environment={environment} />
      </div>
    </div>
  );
}
