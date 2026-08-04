import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Search, Bell, ChevronDown, LogOut, User } from "lucide-react";
import { logout, type Session } from "@/lib/api";

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="flex size-9 items-center justify-center border border-transparent text-slate hover:border-rule hover:text-ink"
      >
        <Bell className="size-[17px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 border border-rule bg-paper shadow-[var(--shadow-2)]">
          <div className="border-b border-rule px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Notifications</p>
          </div>
          <p className="px-4 py-6 text-center text-[12.5px] text-slate">No notifications yet.</p>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function UserMenu({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  async function handleLogout() {
    await logout();
    await navigate({ to: "/login" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2.5 border border-transparent py-1 pr-1 pl-1 hover:border-rule"
      >
        {session.user.avatarUrl ? (
          <img src={session.user.avatarUrl} alt="" className="size-8 shrink-0 object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center bg-ink font-mono text-[12px] font-semibold text-paper">
            {initials(session.user.name)}
          </span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold text-ink">{session.user.name}</span>
          <span className="block text-[11.5px] text-slate capitalize">
            {session.user.role.replace("_", " ")}
          </span>
        </span>
        <ChevronDown className="size-[15px] text-slate" />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 border border-rule bg-paper shadow-[var(--shadow-2)]">
          <div className="border-b border-rule px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">{session.user.name}</p>
            <p className="text-[12px] text-slate">{session.organization.name}</p>
          </div>
          <div className="flex flex-col py-1.5">
            <Link
              to="/settings/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-ink hover:bg-surface-2"
            >
              <User className="size-[15px] text-slate" /> Profile
            </Link>
          </div>
          <div className="border-t border-rule py-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-verdict-block hover:bg-verdict-block/10"
            >
              <LogOut className="size-[15px]" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ session }: { session: Session }) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-rule bg-paper px-5">
      <div className="relative w-64">
        <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-2.5 size-[15px] text-slate" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search…"
          className="h-9 w-full border border-rule bg-paper pr-10 pl-8 text-[13px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 my-auto flex h-5 items-center border border-rule px-1.5 font-machine text-[10px] text-slate">
          ⌘K
        </span>
      </div>

      <NotificationBell />
      <UserMenu session={session} />
    </header>
  );
}
