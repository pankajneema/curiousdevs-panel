import { Outlet, createFileRoute } from "@tanstack/react-router";
import { TeamTabs } from "@/components/shell/TeamTabs";
import { getStoredSession } from "@/lib/api";

export const Route = createFileRoute("/_app/team")({
  component: TeamLayout,
});

function TeamLayout() {
  const session = getStoredSession()!;
  return (
    <div>
      <div className="px-5 pt-6">
        <h1 className="mx-auto max-w-7xl text-[22px] font-bold tracking-[-0.01em] text-ink">Team</h1>
        <p className="mx-auto max-w-7xl mt-1 text-[13.5px] text-slate">
          Who has access to {session.organization.name}.
        </p>
      </div>
      <div className="mt-4">
        <TeamTabs />
      </div>
      <Outlet />
    </div>
  );
}
