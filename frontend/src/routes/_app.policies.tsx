import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, createPolicy, deletePolicy, listPolicies, updatePolicy, type PolicyInput } from "@/lib/api";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { Policy, PolicyStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/policies")({
  component: PoliciesPage,
});

const statusClass: Record<PolicyStatus, string> = {
  active: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  draft: "border-rule text-slate",
};

function emptyPolicyValues(): PolicyInput {
  return { name: "", description: "", status: "draft" };
}

function policyToValues(policy: Policy): PolicyInput {
  return { name: policy.name, description: policy.description, status: policy.status };
}

function PolicyFormModal({
  title,
  initialValues,
  onSubmit,
  onClose,
}: {
  title: string;
  initialValues: PolicyInput;
  onSubmit: (values: PolicyInput) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<PolicyInput>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="policy-form" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="policy-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
        <Field label="Policy name" htmlFor="policy-name">
          <Input
            id="policy-name"
            placeholder="No external email sends"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </Field>
        <Field label="Description" htmlFor="policy-description" hint="What this policy is meant to keep an agent from doing.">
          <textarea
            id="policy-description"
            rows={3}
            placeholder="Blocks agents from sending email to addresses outside the org domain."
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            className="w-full resize-none border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          />
        </Field>
        <Field label="Status" htmlFor="policy-status" hint="Draft policies are visible but not yet meant to be relied on.">
          <select
            id="policy-status"
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as PolicyStatus }))}
            className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}

function PoliciesPage() {
  const { preferences } = usePreferences();
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setPolicies(await listPolicies());
  }

  useEffect(() => {
    refresh();
  }, []);

  const editingPolicy = policies?.find((p) => p.id === editingId) ?? null;

  async function handleDelete(id: string) {
    try {
      await deletePolicy(id);
      setPolicies((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this policy. Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Policies</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-slate">
            What each policy records is organizational intent, and which agents it's attached to — not a live,
            enforced rule. A real-time enforcement engine that reads these against an agent's actual calls is
            next up; until then, every agent runs on whatever your own review of it decides.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-[14px]" /> New policy
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      <Card className="mt-6 p-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Policy</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Agents</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Created</th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies === null && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-[13px] text-slate">
                  Loading policies…
                </td>
              </tr>
            )}
            {policies !== null && policies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <span className="flex flex-col items-center gap-2">
                    <SlidersHorizontal className="size-[18px] text-slate" />
                    <span className="text-[13px] text-slate">No policies yet. Create one to attach to an agent.</span>
                  </span>
                </td>
              </tr>
            )}
            {policies !== null &&
              policies.map((policy) => (
                <tr key={policy.id} className="border-b border-rule last:border-0 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <p className="text-[13.5px] font-semibold text-ink">{policy.name}</p>
                    {policy.description && (
                      <p className="mt-0.5 max-w-md truncate text-[12px] text-slate" title={policy.description}>
                        {policy.description}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[policy.status]}`}>
                      {policy.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-machine text-[12.5px] whitespace-nowrap text-ink tabular-nums">
                    {policy.attachedAgentCount}
                  </td>
                  <td className="px-3 py-3 text-[12.5px] whitespace-nowrap text-slate">
                    {formatDate(policy.createdAt, preferences)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(policy.id)}
                        className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                      >
                        <Pencil className="size-[12px]" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(policy.id)}
                        className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                      >
                        <Trash2 className="size-[12px]" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      {creating && (
        <PolicyFormModal
          title="New policy"
          initialValues={emptyPolicyValues()}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const created = await createPolicy(values);
            setPolicies((prev) => (prev ? [...prev, created] : [created]));
            setCreating(false);
          }}
        />
      )}

      {editingPolicy && (
        <PolicyFormModal
          title={`Edit ${editingPolicy.name}`}
          initialValues={policyToValues(editingPolicy)}
          onClose={() => setEditingId(null)}
          onSubmit={async (values) => {
            const updated = await updatePolicy(editingPolicy.id, values);
            setPolicies((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev));
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
