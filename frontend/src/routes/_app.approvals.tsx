import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock, SquareCheck, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, decideApprovalRequest, listApprovalRequests, subscribeToOrgEvents } from "@/lib/api";
import { formatDate, usePreferences } from "@/lib/preferences";
import type { ApprovalRequest, ApprovalStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/approvals")({
  component: ApprovalsPage,
});

const statusClass: Record<ApprovalStatus, string> = {
  pending: "border-verdict-escalate/30 bg-verdict-escalate/10 text-ink",
  approved: "border-verdict-allow/30 bg-verdict-allow/10 text-ink",
  denied: "border-verdict-block/30 bg-verdict-block/10 text-verdict-block",
  expired: "border-rule text-slate",
};

const statusLabel: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  expired: "Expired",
};

const filters: (ApprovalStatus | "all")[] = ["pending", "approved", "denied", "expired", "all"];

function DenyModal({
  request,
  onClose,
  onDenied,
}: {
  request: ApprovalRequest;
  onClose: () => void;
  onDenied: (updated: ApprovalRequest) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeny() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await decideApprovalRequest(request.id, "denied", reason.trim() || undefined);
      onDenied(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't deny this request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Deny request"
      subtitle={request.actionSummary}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={handleDeny} disabled={submitting}>
            {submitting ? "Denying…" : "Deny"}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <label htmlFor="deny-reason" className="text-[13px] font-semibold text-ink">
        Reason <span className="font-normal text-slate">(optional, shown to whoever reviews this later)</span>
      </label>
      <textarea
        id="deny-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Outside this agent's normal scope."
        className="mt-1.5 w-full resize-none border border-rule bg-paper px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
      />
    </Modal>
  );
}

function PendingCard({
  request,
  preferences,
  onChanged,
}: {
  request: ApprovalRequest;
  preferences: ReturnType<typeof usePreferences>["preferences"];
  onChanged: (updated: ApprovalRequest) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      const updated = await decideApprovalRequest(request.id, "approved");
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve this request. Try again.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/agents/$agentId"
            params={{ agentId: request.agentId }}
            className="text-[12px] font-medium text-signal hover:text-signal-deep"
          >
            {request.agentName}
          </Link>
          <p className="mt-0.5 text-[14px] font-semibold text-ink">{request.actionSummary}</p>
          {request.context && <p className="mt-1 text-[12.5px] leading-relaxed text-slate">{request.context}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 font-machine text-[10.5px] whitespace-nowrap text-slate">
          <Clock className="size-[11px]" />
          {formatDate(request.requestedAt, preferences)}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={handleApprove} disabled={approving || denying}>
          <Check className="size-[13px]" /> {approving ? "Approving…" : "Approve"}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setDenying(true)} disabled={approving}>
          <X className="size-[13px]" /> Deny
        </Button>
        {request.expiresAt && (
          <span className="ml-auto text-[11.5px] text-slate">Expires {formatDate(request.expiresAt, preferences)}</span>
        )}
      </div>

      {denying && (
        <DenyModal
          request={request}
          onClose={() => setDenying(false)}
          onDenied={(updated) => {
            setDenying(false);
            onChanged(updated);
          }}
        />
      )}
    </Card>
  );
}

function ApprovalsPage() {
  const { preferences } = usePreferences();
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [filter, setFilter] = useState<ApprovalStatus | "all">("pending");

  async function refresh() {
    setRequests(await listApprovalRequests(filter === "all" ? undefined : filter));
  }

  useEffect(() => {
    refresh();
  }, [filter]);

  useEffect(() => {
    return subscribeToOrgEvents((event) => {
      if (event.type === "approval_request.status") refresh();
    });
  }, [filter]);

  function handleChanged(updated: ApprovalRequest) {
    setRequests((prev) => {
      if (!prev) return prev;
      if (filter !== "all" && updated.status !== filter) return prev.filter((r) => r.id !== updated.id);
      return prev.map((r) => (r.id === updated.id ? updated : r));
    });
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const decided = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink">Approvals</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-slate">
        A real queue — an agent creates a request with its own API key when it wants to do something above its
        normal authority, and it sits here until a human decides. Every decision is one at a time, on purpose:
        no bulk approve.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "border px-2.5 py-1.5 font-machine text-[11px] tracking-wide uppercase",
              filter === f ? "border-signal bg-signal/10 text-signal" : "border-rule text-slate hover:text-ink",
            ].join(" ")}
          >
            {f === "all" ? "All" : statusLabel[f]}
          </button>
        ))}
      </div>

      {requests === null && <p className="mt-6 text-[13px] text-slate">Loading…</p>}

      {requests !== null && requests.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 border border-dashed border-rule px-6 py-16 text-center">
          <SquareCheck className="size-[18px] text-slate" />
          <p className="text-[13px] text-slate">Nothing here.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {pending.map((request) => (
            <PendingCard key={request.id} request={request} preferences={preferences} onChanged={handleChanged} />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <Card className="mt-6 p-0">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Request</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Status</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">Decided by</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate uppercase">When</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((request) => (
                <tr key={request.id} className="border-b border-rule last:border-0 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-ink">{request.actionSummary}</p>
                    <p className="mt-0.5 text-[11.5px] text-slate">{request.agentName}</p>
                    {request.decisionReason && (
                      <p className="mt-1 text-[11.5px] text-slate italic">“{request.decisionReason}”</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`border px-2 py-0.5 font-machine text-[10px] whitespace-nowrap tracking-wide uppercase ${statusClass[request.status]}`}
                    >
                      {statusLabel[request.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12.5px] whitespace-nowrap text-ink">
                    {request.decidedByName ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] whitespace-nowrap text-slate">
                    {request.decidedAt ? formatDate(request.decidedAt, preferences) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
