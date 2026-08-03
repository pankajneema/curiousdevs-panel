import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bot,
  SlidersHorizontal,
  Server,
  Activity,
  SquareCheck,
  FileClock,
  Users,
  Settings,
  KeyRound,
  Bell,
  Plug,
  ChevronUp,
  User,
  LogOut,
} from "lucide-react";
import { Logo, Wordmark } from "@/components/Logo";
import { logout, type Session } from "@/lib/api";
import { usePreferences } from "@/lib/preferences";
import type { ComponentType } from "react";

interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

const operateItems: NavItem[] = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Agents", to: "/agents", icon: Bot },
  { label: "Policies", to: "/policies", icon: SlidersHorizontal },
  { label: "MCP servers", to: "/mcp-servers", icon: Server },
  { label: "Monitoring", to: "/monitoring", icon: Activity },
  { label: "Approvals", to: "/approvals", icon: SquareCheck },
  { label: "Evidence", to: "/evidence", icon: FileClock },
];

const workspaceItems: NavItem[] = [
  { label: "Team", to: "/team", icon: Users },
  { label: "API & developer", to: "/developer", icon: KeyRound },
  { label: "Integrations", to: "/integrations", icon: Plug },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Settings", to: "/settings", icon: Settings },
];

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={[
        "flex items-center gap-3 px-3 py-2 text-[13.5px] font-medium transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        collapsed ? "justify-center" : "",
        isActive
          ? "border-l-2 border-signal bg-signal/10 text-signal"
          : "border-l-2 border-transparent text-slate hover:bg-surface-2 hover:text-ink",
      ].join(" ")}
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={2} />
      {!collapsed && item.label}
    </Link>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SidebarUserMenu({ session, collapsed }: { session: Session; collapsed: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    await logout();
    await navigate({ to: "/login" });
  }

  return (
    <div ref={ref} className="relative border-t border-rule">
      {open && (
        <div
          className={[
            "absolute z-10 w-56 border border-rule bg-paper shadow-[var(--shadow-2)]",
            collapsed ? "bottom-0 left-full ml-2" : "inset-x-2 bottom-full mb-2",
          ].join(" ")}
        >
          <Link
            to="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-ink hover:bg-surface-2"
          >
            <User className="size-[14px] text-slate" /> Profile
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 border-t border-rule px-3 py-2.5 text-left text-[13px] text-verdict-block hover:bg-verdict-block/10"
          >
            <LogOut className="size-[14px]" /> Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={[
          "flex w-full items-center gap-2.5 px-4 py-3 hover:bg-surface-2",
          collapsed ? "justify-center" : "",
        ].join(" ")}
      >
        {session.user.avatarUrl ? (
          <img src={session.user.avatarUrl} alt="" className="size-8 shrink-0 object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center bg-ink font-mono text-[11px] font-semibold text-paper">
            {initials(session.user.name)}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {session.user.name}
              </span>
              <span className="block text-[11px] text-slate capitalize">
                {session.user.role.replace("_", " ")}
              </span>
            </span>
            <ChevronUp className={`size-[14px] shrink-0 text-slate transition-transform ${open ? "" : "rotate-180"}`} />
          </>
        )}
      </button>
    </div>
  );
}

export function Sidebar({ session }: { session: Session }) {
  const { preferences } = usePreferences();
  const collapsed = preferences.sidebarCollapsed;

  return (
    <aside
      className={[
        "flex shrink-0 flex-col border border-rule bg-paper shadow-[var(--shadow-1)] transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        collapsed ? "w-[68px]" : "w-[248px]",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2.5 border-b border-rule px-4 py-4",
          collapsed ? "justify-center px-0" : "",
        ].join(" ")}
      >
        <Logo size={26} />
        {!collapsed && <Wordmark />}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto py-5">
        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-4 pb-2 font-machine text-[10px] tracking-[0.14em] text-slate uppercase">
              Operate
            </p>
          )}
          {operateItems.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-4 pb-2 font-machine text-[10px] tracking-[0.14em] text-slate uppercase">
              Workspace
            </p>
          )}
          {workspaceItems.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <SidebarUserMenu session={session} collapsed={collapsed} />
    </aside>
  );
}
