import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_app/monitoring")({
  component: () => (
    <ComingSoon
      icon={Activity}
      title="Monitoring"
      description="Live decision counters, verdict split, latency against the 10ms budget, and alerting will land here."
    />
  ),
});
