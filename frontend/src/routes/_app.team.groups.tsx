import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Eye, Plus, Search, SlidersHorizontal, Trash2, UserPlus, UserX, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createGroup,
  deleteGroup,
  listGroups,
  listRoles,
  listTeam,
  updateGroupMembers,
  updateMemberRole,
} from "@/lib/api";
import { formatDate, usePreferences } from "@/lib/preferences";
import { BUILT_IN_ROLES, PERMISSIONS, resolveRoleName, resolveRolePermissions } from "@/lib/roles";
import type { CustomRole, Group, Role, RoleId, User } from "@/lib/types";

export const Route = createFileRoute("/_app/team/groups")({
  component: GroupsPage,
});

const permissionGroups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Create-group member picker (checkbox multi-select — there's no
// existing group yet to view/act on, so a simple list fits) ───────────────

function MemberPicker({
  members,
  selectedIds,
  onToggle,
}: {
  members: User[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  return (
    <div className="flex flex-col gap-2">
      {members.length > 6 && (
        <Input
          placeholder="Search members…"
          icon={<Search className="size-[14px]" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-3 text-[12.5px] text-slate">No members match "{search}".</p>}
        {filtered.map((m) => {
          const checked = selectedIds.includes(m.id);
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onToggle(m.id)}
              className="flex items-center gap-2.5 px-2 py-1.5 text-left hover:bg-paper"
            >
              <span
                className={[
                  "flex size-4 shrink-0 items-center justify-center border",
                  checked ? "border-signal bg-signal" : "border-rule bg-paper",
                ].join(" ")}
              >
                {checked && <Check className="size-[11px] text-paper" strokeWidth={3} />}
              </span>
              <span className="flex size-6 shrink-0 items-center justify-center bg-surface-2 font-mono text-[10px] font-semibold text-ink">
                {initials(m.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{m.name}</span>
                <span className="block truncate text-[11.5px] text-slate">{m.email}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Member details (View) ────────────────────────────────────────────────

function MemberViewModal({
  member,
  customRoles,
  onClose,
}: {
  member: User;
  customRoles: CustomRole[];
  onClose: () => void;
}) {
  const { preferences } = usePreferences();
  const permissions = resolveRolePermissions(member.role, customRoles);

  return (
    <Modal title={member.name} subtitle={member.email} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" className="size-11 shrink-0 object-cover" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center bg-surface-2 font-mono text-[14px] font-semibold text-ink">
              {initials(member.name)}
            </span>
          )}
          <div>
            <p className="text-[14px] font-semibold text-ink">{member.name}</p>
            <p className="text-[12.5px] text-slate">@{member.username}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">User ID</dt>
            <dd className="mt-0.5 font-mono text-[11.5px] text-ink">{member.id}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Role</dt>
            <dd className="mt-0.5 text-ink">{resolveRoleName(member.role, customRoles)}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Phone</dt>
            <dd className="mt-0.5 text-ink">{member.phone || "Not set"}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Job title</dt>
            <dd className="mt-0.5 text-ink">{member.jobTitle || "Not set"}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Department</dt>
            <dd className="mt-0.5 text-ink">{member.department || "Not set"}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Joined</dt>
            <dd className="mt-0.5 text-ink">{formatDate(member.createdAt, preferences)}</dd>
          </div>
          <div>
            <dt className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Last active</dt>
            <dd className="mt-0.5 text-ink">
              {member.lastActiveAt ? formatDate(member.lastActiveAt, preferences) : "Never"}
            </dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">Permissions</p>
          <div className="flex flex-col gap-2.5">
            {permissionGroups.map((group) => {
              const inGroup = PERMISSIONS.filter((p) => p.group === group && permissions.includes(p.key));
              if (inGroup.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-[11px] text-slate">{group}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {inGroup.map((p) => (
                      <span key={p.key} className="border border-signal/30 bg-signal/10 px-2 py-0.5 text-[11.5px] text-signal">
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {permissions.length === 0 && <p className="text-[12.5px] text-slate">No permissions.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Member actions: change role, remove from group ───────────────────────

function MemberActionModal({
  member,
  group,
  assignableRoles,
  onClose,
  onRoleChanged,
  onRemovedFromGroup,
}: {
  member: User;
  group: Group;
  assignableRoles: { id: RoleId; name: string }[];
  onClose: () => void;
  onRoleChanged: (userId: string, role: RoleId) => Promise<void>;
  onRemovedFromGroup: (group: Group) => void;
}) {
  const [role, setRole] = useState<RoleId>(member.role);
  const [savingRole, setSavingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = member.role === "owner";

  async function handleSaveRole() {
    setError(null);
    setSavingRole(true);
    try {
      await onRoleChanged(member.id, role);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the role. Try again.");
    } finally {
      setSavingRole(false);
    }
  }

  async function handleRemoveFromGroup() {
    setError(null);
    setRemoving(true);
    try {
      const next = group.memberUserIds.filter((id) => id !== member.id);
      const updated = await updateGroupMembers(group.id, next);
      onRemovedFromGroup(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove this member. Try again.");
      setRemoving(false);
    }
  }

  return (
    <Modal title={`Manage ${member.name}`} subtitle={member.email} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {error && (
          <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
            {error}
          </p>
        )}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Role</p>
          {isOwner ? (
            <div className="flex h-11 items-center border border-rule bg-surface-2 px-3.5 text-[14px] text-ink">
              Owner
              <span className="ml-2 text-[12px] text-slate">— can't be changed</span>
            </div>
          ) : (
            <>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleId)}
                className="h-11 w-full border border-rule bg-paper px-3.5 text-[15px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <Button size="sm" className="mt-2.5" onClick={handleSaveRole} disabled={savingRole || role === member.role}>
                {savingRole ? "Saving…" : "Save role"}
              </Button>
            </>
          )}
        </div>

        <div className="border-t border-rule pt-4">
          <p className="mb-1 text-[13px] font-semibold text-ink">Remove from this group</p>
          <p className="mb-3 text-[12px] text-slate">
            Only removes them from "{group.name}" — this doesn't remove them from the organization.
          </p>
          <Button variant="destructive" size="sm" onClick={handleRemoveFromGroup} disabled={removing}>
            <UserX className="size-[14px]" /> {removing ? "Removing…" : "Remove from group"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Existing-group members table ──────────────────────────────────────────

function GroupMembersTable({
  group,
  allMembers,
  customRoles,
  assignableRoles,
  onChanged,
  onRoleChanged,
}: {
  group: Group;
  allMembers: User[];
  customRoles: CustomRole[];
  assignableRoles: { id: RoleId; name: string }[];
  onChanged: (group: Group) => void;
  onRoleChanged: (userId: string, role: RoleId) => Promise<void>;
}) {
  const [viewing, setViewing] = useState<User | null>(null);
  const [managing, setManaging] = useState<User | null>(null);
  const [addId, setAddId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupMembers = allMembers.filter((m) => group.memberUserIds.includes(m.id));
  const nonMembers = allMembers.filter((m) => !group.memberUserIds.includes(m.id));

  async function handleAdd() {
    if (!addId) return;
    setError(null);
    setAdding(true);
    try {
      const updated = await updateGroupMembers(group.id, [...group.memberUserIds, addId]);
      onChanged(updated);
      setAddId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that member. Try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
          {error}
        </p>
      )}

      {nonMembers.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Add a member" htmlFor={`add-${group.id}`}>
              <select
                id={`add-${group.id}`}
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="h-10 w-full border border-rule bg-paper px-3 text-[13px] text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              >
                <option value="">Choose someone…</option>
                {nonMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!addId || adding}>
            <Plus className="size-[14px]" /> {adding ? "Adding…" : "Add"}
          </Button>
        </div>
      )}

      <div className="border border-rule">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-rule bg-surface-2 font-machine text-[10px] tracking-[0.1em] text-slate uppercase">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {groupMembers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-center text-slate">
                  No members in this group yet.
                </td>
              </tr>
            )}
            {groupMembers.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center bg-surface-2 font-mono text-[10px] font-semibold text-ink">
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{m.name}</p>
                      <p className="truncate text-[11.5px] text-slate">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-ink">{resolveRoleName(m.role, customRoles)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewing(m)}
                      className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                    >
                      <Eye className="size-[12px]" /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => setManaging(m)}
                      className="flex items-center gap-1 border border-rule px-2 py-1 text-[11.5px] font-medium text-slate hover:text-ink"
                    >
                      <SlidersHorizontal className="size-[12px]" /> Action
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && <MemberViewModal member={viewing} customRoles={customRoles} onClose={() => setViewing(null)} />}
      {managing && (
        <MemberActionModal
          member={managing}
          group={group}
          assignableRoles={assignableRoles}
          onClose={() => setManaging(null)}
          onRoleChanged={onRoleChanged}
          onRemovedFromGroup={onChanged}
        />
      )}
    </div>
  );
}

// ─── Group row ──────────────────────────────────────────────────────────

function GroupRow({
  group,
  allMembers,
  customRoles,
  assignableRoles,
  onChanged,
  onDeleted,
  onRoleChanged,
}: {
  group: Group;
  allMembers: User[];
  customRoles: CustomRole[];
  assignableRoles: { id: RoleId; name: string }[];
  onChanged: (group: Group) => void;
  onDeleted: (id: string) => void;
  onRoleChanged: (userId: string, role: RoleId) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteGroup(group.id);
      onDeleted(group.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this group. Try again.");
      setDeleting(false);
    }
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
            disabled={deleting}
            className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block disabled:opacity-60"
          >
            <Trash2 className="size-[13px]" /> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      {error && !expanded && (
        <p role="alert" className="mx-5 mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[12.5px] text-ink">
          {error}
        </p>
      )}
      {expanded && (
        <div className="border-t border-rule bg-surface-2 px-5 py-4">
          <GroupMembersTable
            group={group}
            allMembers={allMembers}
            customRoles={customRoles}
            assignableRoles={assignableRoles}
            onChanged={onChanged}
            onRoleChanged={onRoleChanged}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [builtInRoles, setBuiltInRoles] = useState<{ id: Role; name: string }[]>(BUILT_IN_ROLES);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allRoles = [...builtInRoles, ...customRoles.map((r) => ({ id: r.id, name: r.name }))];
  const assignableRoles = allRoles.filter((r) => r.id !== "owner");

  async function refresh() {
    const [groupList, { members }, { builtIn, custom }] = await Promise.all([listGroups(), listTeam(), listRoles()]);
    setGroups(groupList);
    setMembers(members);
    setBuiltInRoles(builtIn);
    setCustomRoles(custom);
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetCreateForm() {
    setName("");
    setSelectedMemberIds([]);
    setCreating(false);
    setError(null);
  }

  function toggleSelectedMember(userId: string) {
    setSelectedMemberIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const group = await createGroup(name, selectedMemberIds);
      setGroups((prev) => [...(prev ?? []), group]);
      resetCreateForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGroupChanged(updated: Group) {
    setGroups((prev) => (prev ? prev.map((g) => (g.id === updated.id ? updated : g)) : prev));
  }

  function handleGroupDeleted(id: string) {
    setGroups((prev) => (prev ? prev.filter((g) => g.id !== id) : prev));
  }

  async function handleMemberRoleChanged(userId: string, role: RoleId) {
    await updateMemberRole(userId, role);
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)));
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
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
            <Field label="Group name" htmlFor="group-name">
              <Input
                id="group-name"
                placeholder="e.g. On-call approvers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </Field>

            <div className="mt-4">
              <p className="mb-2 text-[12.5px] font-medium text-ink">
                Members <span className="font-normal text-slate">({selectedMemberIds.length} selected, plus the owner)</span>
              </p>
              <MemberPicker members={members} selectedIds={selectedMemberIds} onToggle={toggleSelectedMember} />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create group"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetCreateForm}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div>
          {groups === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
          {groups?.length === 0 && !creating && <p className="px-5 py-6 text-[13px] text-slate">No groups yet.</p>}
          {groups?.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              allMembers={members}
              customRoles={customRoles}
              assignableRoles={assignableRoles}
              onChanged={handleGroupChanged}
              onDeleted={handleGroupDeleted}
              onRoleChanged={handleMemberRoleChanged}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
