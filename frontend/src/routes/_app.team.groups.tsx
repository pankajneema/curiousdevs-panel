import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, createGroup, deleteGroup, listGroups, listTeam, updateGroupMembers } from "@/lib/api";
import type { Group, User } from "@/lib/types";

export const Route = createFileRoute("/_app/team/groups")({
  component: GroupsPage,
});

function GroupRow({
  group,
  members,
  startExpanded,
  onChanged,
}: {
  group: Group;
  members: User[];
  startExpanded: boolean;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(startExpanded);

  async function toggleMember(userId: string) {
    const next = group.memberUserIds.includes(userId)
      ? group.memberUserIds.filter((id) => id !== userId)
      : [...group.memberUserIds, userId];
    await updateGroupMembers(group.id, next);
    onChanged();
  }

  async function handleDelete() {
    await deleteGroup(group.id);
    onChanged();
  }

  return (
    <div className="border-b border-rule last:border-0">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-9 items-center justify-center bg-surface-2 text-slate">
            <Users className="size-[15px]" />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-ink">{group.name}</p>
            <p className="text-[12px] text-slate">
              {group.memberUserIds.length} member{group.memberUserIds.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={[
              "flex items-center gap-1.5 border px-2.5 py-1.5 text-[12px] font-medium",
              expanded ? "border-signal bg-signal/10 text-signal" : "border-rule text-slate hover:text-ink",
            ].join(" ")}
          >
            <UserPlus className="size-[13px]" />
            Manage members
            <ChevronDown className={`size-[13px] transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
          >
            <Trash2 className="size-[13px]" /> Delete
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-rule bg-surface-2 px-5 py-3">
          <p className="mb-2 text-[11.5px] text-slate">Click a member to add or remove them from this group.</p>
          <div className="flex flex-col gap-1">
            {members.map((m) => {
              const checked = group.memberUserIds.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className="flex items-center gap-2.5 px-2 py-1.5 text-left hover:bg-paper"
                >
                  <span
                    className={[
                      "flex size-4 items-center justify-center border",
                      checked ? "border-signal bg-signal" : "border-rule bg-paper",
                    ].join(" ")}
                  >
                    {checked && <Check className="size-[11px] text-paper" strokeWidth={3} />}
                  </span>
                  <span className="text-[13px] text-ink">{m.name}</span>
                  <span className="text-[12px] text-slate">{m.email}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  async function refresh() {
    const [groupList, { members }] = await Promise.all([listGroups(), listTeam()]);
    setGroups(groupList);
    setMembers(members);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const group = await createGroup(name);
      setJustCreatedId(group.id);
      setName("");
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <div className="pr-4">
            <p className="text-[13px] font-semibold text-ink">Groups</p>
            <p className="mt-0.5 text-[12px] text-slate">
              Collections of members, for scoping policy and approvals to a team later. The organization
              owner is added to every new group automatically.
            </p>
          </div>
          {!creating && (
            <Button size="sm" className="shrink-0" onClick={() => setCreating(true)}>
              <Plus className="size-[14px]" /> New group
            </Button>
          )}
        </div>

        {creating && (
          <form className="border-b border-rule px-5 py-4" onSubmit={handleCreate} noValidate>
            {error && (
              <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
                {error}
              </p>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Group name" htmlFor="group-name">
                  <Input id="group-name" placeholder="e.g. On-call approvers" value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div>
          {groups === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
          {groups?.length === 0 && !creating && <p className="px-5 py-6 text-[13px] text-slate">No groups yet.</p>}
          {groups?.map((g) => (
            <GroupRow key={g.id} group={g} members={members} startExpanded={g.id === justCreatedId} onChanged={refresh} />
          ))}
        </div>
      </Card>
    </div>
  );
}
