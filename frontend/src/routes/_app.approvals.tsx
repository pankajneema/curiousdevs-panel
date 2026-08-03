import { createFileRoute } from "@tanstack/react-router";
import { SquareCheck } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_app/approvals")({
  component: () => (
    <ComingSoon
      icon={SquareCheck}
      title="Approvals"
      description="The escalation queue, raw-action review, delegation and approval history will land here. No bulk approve — ever."
    />
  ),
});
