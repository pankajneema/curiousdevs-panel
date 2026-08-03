import { createContext, useContext } from "react";
import type { Environment } from "./types";

const STORAGE_KEY = "agentguard_console_environment";

export function getStoredEnvironment(): Environment {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "DEV" || raw === "STAGING" || raw === "PROD" ? raw : "PROD";
}

export function storeEnvironment(env: Environment): void {
  localStorage.setItem(STORAGE_KEY, env);
}

export const EnvironmentContext = createContext<{
  environment: Environment;
  setEnvironment: (env: Environment) => void;
} | null>(null);

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) throw new Error("useEnvironment must be used within EnvironmentContext.Provider");
  return ctx;
}
