import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SettingsTabs } from "@/components/shell/SettingsTabs";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div>
      <div className="px-5 pt-6">
        <h1 className="mx-auto max-w-7xl text-[22px] font-bold tracking-[-0.01em] text-ink">Settings</h1>
      </div>
      <div className="mt-4">
        <SettingsTabs />
      </div>
      <Outlet />
    </div>
  );
}
