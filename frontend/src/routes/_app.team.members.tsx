import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  getStoredSession,
  inviteTeamMember,
  listRoles,
  listTeam,
  removeTeamMember,
  revokeTeamInvitation,
  subscribeToOrgEvents,
  updateMemberRole,
} from "@/lib/api";
import { resolveRoleName } from "@/lib/roles";
import type { CustomRole, Invitation, Role, RoleId, User } from "@/lib/types";

function EmailStatusBadge({ status }: { status: Invitation["emailStatus"] }) {
  if (status === "sent") {
    return (
      <span className="font-machine text-[10px] tracking-wide text-verdict-allow uppercase">Email sent</span>
    );
  }
  if (status === "failed") {
    return (
      <span className="font-machine text-[10px] tracking-wide text-verdict-block uppercase">Delivery failed</span>
    );
  }
  return <span className="font-machine text-[10px] tracking-wide text-slate uppercase">Sending…</span>;
}

export const Route = createFileRoute("/_app/team/members")({
  component: MembersPage,
});

function MembersPage() {
  const session = getStoredSession()!;
  const [members, setMembers] = useState<User[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [builtInRoles, setBuiltInRoles] = useState<{ id: Role; name: string }[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleId>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const allRoles = [...builtInRoles, ...customRoles.map((r) => ({ id: r.id, name: r.name }))];
  // The owner role is set once at registration and never reassigned — there's
  // always exactly one, so it's never offered as an invite or role-change option.
  const assignableRoles = allRoles.filter((r) => r.id !== "owner");

  async function refresh() {
    const [{ members, invitations }, { builtIn, custom }] = await Promise.all([listTeam(), listRoles()]);
    setMembers(members);
    setInvitations(invitations);
    setBuiltInRoles(builtIn);
    setCustomRoles(custom);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    // Live push when a queued invite email finishes sending, instead of
    // polling — flips "Sending…" to "Email sent"/"Delivery failed" in place.
    return subscribeToOrgEvents((event) => {
      if (event.type === "invitation.email_status") {
        setInvitations((prev) =>
          prev.map((inv) => (inv.id === event.invitationId ? { ...inv, emailStatus: event.status } : inv)),
        );
      }
    });
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await inviteTeamMember({ email, role });
      setEmail("");
      setRole("viewer");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeTeamInvitation(id);
    await refresh();
  }

  async function handleRemove(userId: string) {
    try {
      await removeTeamMember(userId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  async function handleRoleChange(userId: string, newRole: RoleId) {
    try {
      await updateMemberRole(userId, newRole);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <Card className="p-6">
        <p className="text-[13px] font-semibold text-ink">Invite a teammate</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInvite} noValidate>
          <div className="flex-1">
            <Field label="Email address" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                icon={<Mail className="size-[17px]" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="w-full sm:w-48">
            <Field label="Role" htmlFor="invite-role">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
            {error}
          </p>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card className="mt-6 p-0">
          <div className="border-b border-rule px-5 py-3">
            <p className="text-[13px] font-semibold text-ink">Pending invitations</p>
          </div>
          <div className="divide-y divide-rule">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{inv.email}</p>
                  <p className="text-[12px] text-slate">Invited as {resolveRoleName(inv.role, customRoles)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <EmailStatusBadge status={inv.emailStatus} />
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
                  >
                    <X className="size-[13px]" /> Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-6 p-0">
        <div className="border-b border-rule px-5 py-3">
          <p className="text-[13px] font-semibold text-ink">Members</p>
        </div>
        <div className="divide-y divide-rule">
          {members === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
          {members?.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center bg-surface-2 font-mono text-[12px] font-semibold text-ink">
                  {member.name
                    .trim()
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{member.name}</p>
                  <p className="text-[12px] text-slate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {member.role === "owner" || member.id === session.user.id ? (
                  <span className="rounded-[var(--radius-chip)] border border-rule px-2.5 py-0.5 font-machine text-[10px] tracking-wide text-slate uppercase">
                    {resolveRoleName(member.role, customRoles)}
                  </span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="border border-rule bg-paper px-2 py-1 font-machine text-[11px] text-ink"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
                {member.role !== "owner" && member.id !== session.user.id && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="text-[12px] font-medium text-slate hover:text-verdict-block"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
