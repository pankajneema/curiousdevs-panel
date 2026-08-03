import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgentList } from "@/components/agents/AgentList";
import { getStoredSession, listAgents } from "@/lib/api";
import { useEnvironment } from "@/lib/environment";
import type { Agent } from "@/lib/types";

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const session = getStoredSession()!;
  const { environment } = useEnvironment();
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    listAgents().then(setAgents);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">
        Welcome, {session.user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-[13.5px] text-slate">
        {session.organization.name} · {agents?.filter((a) => a.environment === environment).length ?? "…"}{" "}
        agents in {environment}
      </p>

      <div className="mt-8">
        <AgentList agents={agents} environment={environment} />
      </div>
    </div>
  );
}
