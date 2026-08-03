import { createFileRoute } from "@tanstack/react-router";
import { Server } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export const Route = createFileRoute("/_app/mcp-servers")({
  component: () => (
    <ComingSoon
      icon={Server}
      title="MCP servers"
      description="Server and tool inventory with pre-connection scanning and re-verification on drift will land here."
    />
  ),
});
