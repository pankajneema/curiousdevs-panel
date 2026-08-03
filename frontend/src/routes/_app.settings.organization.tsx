import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, getStoredSession, updateOrganization } from "@/lib/api";

export const Route = createFileRoute("/_app/settings/organization")({
  component: OrganizationPage,
});

const residencyLabel: Record<string, string> = {
  us: "United States",
  eu: "European Union",
  in: "India",
};

function OrganizationPage() {
  const session = getStoredSession()!;
  const [name, setName] = useState(session.organization.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await updateOrganization({ name });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-[13.5px] text-slate">Organization profile and data handling.</p>

      <Card className="mt-6 p-6">
        <p className="text-[13px] font-semibold text-ink">Organization</p>
        <form className="mt-4 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {error && (
            <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="border border-verdict-allow/30 bg-verdict-allow/10 px-3 py-2 text-[13px] text-ink">
              Organization updated.
            </p>
          )}

          <Field label="Organization name" htmlFor="org-name">
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <Field label="Domain" htmlFor="org-domain" hint={session.organization.domainVerified ? "Verified." : "Not verified yet."}>
            <Input id="org-domain" value={session.organization.domain} disabled />
          </Field>

          <Field
            label="Data residency"
            htmlFor="org-residency"
            hint="Fixed at creation and cannot be changed — contact support if this needs to move."
          >
            <Input
              id="org-residency"
              value={residencyLabel[session.organization.dataResidency] ?? session.organization.dataResidency}
              disabled
            />
          </Field>

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6 border-verdict-block/30 p-6">
        <p className="text-[13px] font-semibold text-verdict-block">Danger zone</p>
        <p className="mt-1 text-[12.5px] text-slate">
          Destructive and irreversible. Each action below is disabled until it ships — typed
          confirmation naming the resource will be required before it can run.
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Revoke every agent credential</p>
            <p className="text-[12px] text-slate">Every connected agent stops working immediately.</p>
          </div>
          <Button variant="destructive" size="sm" disabled title="Not available yet.">
            Revoke all
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Delete organization</p>
            <p className="text-[12px] text-slate">Deletes all agents, policies and evidence. Cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" disabled title="Not available yet.">
            Delete
          </Button>
        </div>

        <div className="mt-4 border-t border-rule pt-4">
          <label htmlFor="confirm-delete" className="text-[12px] text-slate">
            Type <span className="font-machine text-ink">{session.organization.name}</span> to unlock
            deletion (disabled for now).
          </label>
          <Input
            id="confirm-delete"
            className="mt-2"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            disabled
          />
        </div>
      </Card>
    </div>
  );
}
