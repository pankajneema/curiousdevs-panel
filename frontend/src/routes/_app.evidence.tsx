import { createFileRoute } from "@tanstack/react-router";
import { FileClock } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_app/evidence")({
  component: () => (
    <ComingSoon
      icon={FileClock}
      title="Evidence"
      description="Tamper-evident session replay, SOC 2 / ISO 27001 / DPDP exports and legal hold will land here."
    />
  ),
});
