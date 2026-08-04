import { useState } from "react";
import { ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Agent, AgentStatus } from "@/lib/types";

export function AgentStatusActions({
  agent,
  onEdit,
  onStatusChange,
}: {
  agent: Agent;
  onEdit: () => void;
  onStatusChange: (status: AgentStatus) => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);

  async function handleStatus(status: AgentStatus) {
    setChanging(true);
    try {
      await onStatusChange(status);
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={onEdit}>
        Edit
      </Button>
      {agent.status !== "active" && (
        <Button variant="secondary" size="sm" onClick={() => handleStatus("active")} disabled={changing}>
          Reactivate
        </Button>
      )}
      {agent.status !== "watch_only" && agent.status !== "decommissioned" && (
        <Button variant="secondary" size="sm" onClick={() => handleStatus("watch_only")} disabled={changing}>
          Move to watch-only
        </Button>
      )}
      {agent.status !== "quarantined" && agent.status !== "decommissioned" && (
        <Button variant="destructive" size="sm" onClick={() => handleStatus("quarantined")} disabled={changing}>
          <ShieldOff className="size-[13px]" /> Quarantine
        </Button>
      )}
      {agent.status !== "decommissioned" && (
        <Button variant="destructive" size="sm" onClick={() => handleStatus("decommissioned")} disabled={changing}>
          <Trash2 className="size-[13px]" /> Decommission
        </Button>
      )}
    </div>
  );
}
