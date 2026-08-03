import { Link, useRouterState } from "@tanstack/react-router";

const tabs = [
  { label: "Personal info", to: "/settings/profile" },
  { label: "Account", to: "/settings/account" },
  { label: "Security", to: "/settings/security" },
  { label: "Preferences", to: "/settings/preferences" },
  { label: "Organization", to: "/settings/organization" },
  { label: "Billing", to: "/settings/billing" },
];

export function SettingsTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="border-b border-rule px-6">
      <nav className="mx-auto flex max-w-5xl gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={[
                "shrink-0 border-b-2 py-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-[var(--dur-fast)]",
                isActive
                  ? "border-signal text-signal"
                  : "border-transparent text-slate hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
