import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  deleteOrganization,
  getDomainVerification,
  getStoredSession,
  logout,
  revokeAllAgents,
  updateOrganization,
  verifyDomain,
  type DomainVerification,
} from "@/lib/api";

export const Route = createFileRoute("/_app/settings/organization")({
  component: OrganizationPage,
});

const residencyLabel: Record<string, string> = {
  us: "United States",
  eu: "European Union",
  in: "India",
};

function DomainVerificationPanel({
  onVerified,
}: {
  onVerified: () => void;
}) {
  const [info, setInfo] = useState<DomainVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setInfo(await getDomainVerification());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCheck() {
    setError(null);
    setChecking(true);
    try {
      const result = await verifyDomain();
      setInfo(result);
      if (result.domainVerified) onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleCopy() {
    if (!info) return;
    await navigator.clipboard.writeText(info.recordValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!info || info.domainVerified) return null;

  return (
    <div className="border border-rule bg-surface-2 p-4">
      <p className="text-[12.5px] font-medium text-ink">Prove you own {info.domain}</p>
      <p className="mt-1 text-[12px] text-slate">
        Add a TXT record with these values, then check — this is a real DNS lookup, not a formality.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
        <span className="font-machine text-[11px] text-slate uppercase">Record name</span>
        <code className="border border-rule bg-paper px-2 py-1 font-machine text-[11.5px] text-ink">
          {info.recordName}
        </code>
        <span className="font-machine text-[11px] text-slate uppercase">Record value</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto border border-rule bg-paper px-2 py-1 font-machine text-[11.5px] text-ink">
            {info.recordValue}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy record value"
            className="flex size-7 shrink-0 items-center justify-center border border-rule text-slate hover:text-ink"
          >
            {copied ? <Check className="size-[13px] text-verdict-allow" /> : <Copy className="size-[13px]" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
          {error}
        </p>
      )}
      <Button variant="secondary" size="sm" className="mt-3" onClick={handleCheck} disabled={checking}>
        {checking ? "Checking DNS…" : "Check now"}
      </Button>
    </div>
  );
}

function RevokeAllModal({ onClose, onDone }: { onClose: () => void; onDone: (count: number) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const { revokedCount } = await revokeAllAgents();
      onDone(revokedCount);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Revoke every agent credential" onClose={onClose}>
      <p className="text-[13px] text-ink">
        Every agent in this organization will be marked <strong>quarantined</strong> in the registry. This
        doesn't undo itself — each agent has to be reviewed and reinstated individually afterward.
      </p>
      {error && (
        <p role="alert" className="mt-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Revoking…" : "Revoke all"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function OrganizationPage() {
  const navigate = useNavigate();
  const session = getStoredSession()!;
  const [name, setName] = useState(session.organization.name);
  const [domain, setDomain] = useState(session.organization.domain);
  const [domainVerified, setDomainVerified] = useState(session.organization.domainVerified);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokedNotice, setRevokedNotice] = useState<number | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const updated = await updateOrganization({ name, domain });
      setDomainVerified(updated.organization.domainVerified);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteOrganization(confirmDelete);
      await logout();
      await navigate({ to: "/login" });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setDeleting(false);
    }
  }

  const deleteUnlocked = confirmDelete.trim() === session.organization.name;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
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

          <Field
            label="Domain"
            htmlFor="org-domain"
            hint={
              domainVerified
                ? undefined
                : "Changing this resets verification — you'll need to re-prove ownership."
            }
          >
            <Input
              id="org-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              icon={
                domainVerified ? (
                  <ShieldCheck className="size-[16px] text-verdict-allow" />
                ) : (
                  <ShieldAlert className="size-[16px] text-slate" />
                )
              }
              required
            />
          </Field>
          {!domainVerified && <DomainVerificationPanel onVerified={() => setDomainVerified(true)} />}

          <Field
            label="Data residency"
            htmlFor="org-residency"
            hint="Chosen when the organization was created and fixed after that — there's real infrastructure behind this, not just a label."
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
        <p className="mt-1 text-[12.5px] text-slate">Destructive and irreversible. Handle with care.</p>

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Revoke every agent credential</p>
            <p className="text-[12px] text-slate">Marks every agent in the registry as quarantined.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setRevoking(true)}>
            <Trash2 className="size-[13px]" /> Revoke all
          </Button>
        </div>
        {revokedNotice !== null && (
          <p role="status" className="mt-3 border border-verdict-allow/30 bg-verdict-allow/10 px-3 py-2 text-[12.5px] text-ink">
            {revokedNotice} agent{revokedNotice === 1 ? "" : "s"} quarantined.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
          <div>
            <p className="text-[13px] font-medium text-ink">Delete organization</p>
            <p className="text-[12px] text-slate">Deletes every user, agent, group and record. Cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" disabled={!deleteUnlocked || deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
        {deleteError && (
          <p role="alert" className="mt-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
            {deleteError}
          </p>
        )}

        <div className="mt-4 border-t border-rule pt-4">
          <label htmlFor="confirm-delete" className="text-[12px] text-slate">
            Type <span className="font-machine text-ink">{session.organization.name}</span> to unlock deletion.
          </label>
          <Input
            id="confirm-delete"
            className="mt-2"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
          />
        </div>
      </Card>

      {revoking && (
        <RevokeAllModal
          onClose={() => setRevoking(false)}
          onDone={(count) => {
            setRevoking(false);
            setRevokedNotice(count);
          }}
        />
      )}
    </div>
  );
}
