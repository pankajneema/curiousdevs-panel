import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { getStoredSession, useSession } from "@/lib/api";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (!getStoredSession()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  // Reactive: re-renders on profile/avatar updates and logout, not just on
  // navigation, so Header/Sidebar never show a stale session.
  const session = useSession();
  if (!session) return null;
  return (
    <AppShell session={session}>
      <Outlet />
    </AppShell>
  );
}
