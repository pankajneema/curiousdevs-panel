import { createContext, useContext } from "react";

export type Density = "comfortable" | "compact";
export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "12h" | "24h";

export interface Preferences {
  density: Density;
  sidebarCollapsed: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

const STORAGE_KEY = "agentguard_console_preferences";

const DEFAULT_PREFERENCES: Preferences = {
  density: "comfortable",
  sidebarCollapsed: false,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

export function getStoredPreferences(): Preferences {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const stored = JSON.parse(raw) as Partial<Preferences>;
    // Sidebar collapse is a per-session choice, not a saved preference — the
    // nav should never be surprisingly hidden on a fresh visit or reload.
    return { ...DEFAULT_PREFERENCES, ...stored, sidebarCollapsed: false };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function storePreferences(prefs: Preferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, sidebarCollapsed: false }));
}

export function formatDate(iso: string, prefs: Pick<Preferences, "dateFormat">): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (prefs.dateFormat === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (prefs.dateFormat === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  return `${mm}/${dd}/${yyyy}`;
}

export function formatTime(iso: string, prefs: Pick<Preferences, "timeFormat">): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: prefs.timeFormat === "12h",
  });
}

export const PreferencesContext = createContext<{
  preferences: Preferences;
  setPreferences: (patch: Partial<Preferences>) => void;
} | null>(null);

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesContext.Provider");
  return ctx;
}
