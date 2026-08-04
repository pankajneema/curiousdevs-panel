import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api";
import type { Agent, ConnectionMethod, Environment, RiskBand, User } from "@/lib/types";

export const environments: Environment[] = ["DEV", "STAGING", "PROD"];
export const connectionMethods: ConnectionMethod[] = ["mcp", "python_sdk", "typescript_sdk", "proxy"];
export const riskBands: RiskBand[] = ["low", "medium", "high", "critical"];

export interface AgentFormValues {
  name: string;
  purpose: string;
  environment: Environment;
  connectionMethods: ConnectionMethod[];
  riskBand: RiskBand;
  hasLethalTrifecta: boolean;
  ownerUserId: string | null;
  expiresAt: string;
}

export function emptyFormValues(defaultEnv: Environment, currentUserId: string): AgentFormValues {
  return {
    name: "",
    purpose: "",
    environment: defaultEnv,
    connectionMethods: ["mcp"],
    riskBand: "low",
    hasLethalTrifecta: false,
    ownerUserId: currentUserId,
    expiresAt: "",
  };
}

export function agentToFormValues(agent: Agent): AgentFormValues {
  return {
    name: agent.name,
    purpose: agent.purpose,
    environment: agent.environment,
    connectionMethods: agent.connectionMethods,
    riskBand: agent.riskBand,
    hasLethalTrifecta: agent.hasLethalTrifecta,
    ownerUserId: agent.ownerUserId,
    expiresAt: agent.expiresAt ? agent.expiresAt.slice(0, 10) : "",
  };
}

function AgentFormFields({
  values,
  onChange,
  members,
}: {
  values: AgentFormValues;
  onChange: (patch: Partial<AgentFormValues>) => void;
  members: User[];
}) {
  function toggleConnectionMethod(method: ConnectionMethod) {
    onChange({
      connectionMethods: values.connectionMethods.includes(method)
        ? values.connectionMethods.filter((m) => m !== method)
        : [...values.connectionMethods, method],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Agent name" htmlFor="agent-name">
        <Input
          id="agent-name"
          placeholder="fraud-detection-agent"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
      </Field>

      <Field label="Purpose" htmlFor="agent-purpose" hint="What this agent is for — shown across the console.">
        <textarea
          id="agent-purpose"
          rows={2}
          placeholder="Scores inbound transactions for fraud risk in real time."
          value={values.purpose}
          onChange={(e) => onChange({ purpose: e.target.value })}
          className="w-full resize-none border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          required
        />
      </Field>

      <Field label="Environment" htmlFor="agent-env">
        <select
          id="agent-env"
          value={values.environment}
          onChange={(e) => onChange({ environment: e.target.value as Environment })}
          className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
        >
          {environments.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink">Connection methods</p>
        <p className="mb-2.5 text-[11.5px] text-slate">
          Pick every surface this agent is reachable on — it isn't limited to one.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {connectionMethods.map((m) => (
            <Checkbox
              key={m}
              id={`agent-conn-${m}`}
              label={m}
              checked={values.connectionMethods.includes(m)}
              onChange={() => toggleConnectionMethod(m)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner" htmlFor="agent-owner">
          <select
            id="agent-owner"
            value={values.ownerUserId ?? ""}
            onChange={(e) => onChange({ ownerUserId: e.target.value || null })}
            className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expires" htmlFor="agent-expires" hint="Optional.">
          <Input
            id="agent-expires"
            type="date"
            value={values.expiresAt}
            onChange={(e) => onChange({ expiresAt: e.target.value })}
          />
        </Field>
      </div>

      <div className="border-t border-rule pt-4">
        <p className="mb-2 text-[12.5px] font-medium text-ink">Risk assessment</p>
        <p className="mb-3 text-[11.5px] text-slate">
          AgentGuard doesn't yet auto-score risk from a live policy engine — until it does, set this from your
          own review.
        </p>
        <Field label="Risk band" htmlFor="agent-risk">
          <select
            id="agent-risk"
            value={values.riskBand}
            onChange={(e) => onChange({ riskBand: e.target.value as RiskBand })}
            className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          >
            {riskBands.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3">
          <Checkbox
            id="agent-trifecta"
            label="Has the lethal trifecta — private data access, untrusted content exposure, and external communication, all at once"
            checked={values.hasLethalTrifecta}
            onChange={(e) => onChange({ hasLethalTrifecta: e.target.checked })}
          />
        </div>
      </div>
    </div>
  );
}

export function AgentFormModal({
  title,
  initialValues,
  members,
  onSubmit,
  onClose,
}: {
  title: string;
  initialValues: AgentFormValues;
  members: User[];
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<AgentFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (values.connectionMethods.length === 0) {
      setError("Choose at least one connection method.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="agent-form" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="agent-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="mb-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
        <AgentFormFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} members={members} />
      </form>
    </Modal>
  );
}
