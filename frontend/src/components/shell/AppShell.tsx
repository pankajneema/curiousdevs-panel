import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { EnvironmentContext, getStoredEnvironment, storeEnvironment } from "@/lib/environment";
import { PreferencesContext, getStoredPreferences, storePreferences, type Preferences } from "@/lib/preferences";
import type { Session } from "@/lib/api";
import type { Environment } from "@/lib/types";

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>(getStoredEnvironment);
  const [preferences, setPreferencesState] = useState<Preferences>(getStoredPreferences);

  function setEnvironment(env: Environment) {
    storeEnvironment(env);
    setEnvironmentState(env);
  }

  function setPreferences(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    storePreferences(next);
    setPreferencesState(next);
  }

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      <PreferencesContext.Provider value={{ preferences, setPreferences }}>
        <div className="flex h-dvh bg-paper">
          <Sidebar session={session} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header session={session} />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </PreferencesContext.Provider>
    </EnvironmentContext.Provider>
  );
}
