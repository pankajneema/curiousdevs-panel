import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_app/policies")({
  component: () => (
    <ComingSoon
      icon={SlidersHorizontal}
      title="Policies"
      description="The rule list, form and YAML editors, simulate and dry-run are next up. Every agent currently runs in watch-only until policy is wired in."
    />
  ),
});
