import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError, createRole, deleteRole, listRoles } from "@/lib/api";
import { BUILT_IN_ROLES, PERMISSIONS } from "@/lib/roles";
import type { CustomRole, Permission } from "@/lib/types";

export const Route = createFileRoute("/_app/team/roles")({
  component: RolesPage,
});

const permissionGroups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

function BuiltInRoleCard({ role }: { role: (typeof BUILT_IN_ROLES)[number] }) {
  return (
    <div className="border-b border-rule px-5 py-4 last:border-0">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-[14px] text-slate" />
        <p className="text-[13.5px] font-semibold text-ink">{role.name}</p>
        <span className="font-machine text-[9.5px] tracking-wide text-slate uppercase">Built-in</span>
      </div>
      <p className="mt-1 text-[12px] text-slate">{role.description}</p>
    </div>
  );
}

function CreateRoleForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(p: Permission) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createRole({ name, permissions });
      setName("");
      setPermissions([]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="border-b border-rule px-5 py-4" onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-3 border border-verdict-block/30 bg-verdict-block/10 px-3 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      <Field label="Role name" htmlFor="role-name">
        <Input id="role-name" placeholder="e.g. Support lead" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <p className="mt-4 text-[12px] font-medium text-ink">Permissions</p>
      <div className="mt-2 flex flex-col gap-3">
        {permissionGroups.map((group) => (
          <div key={group}>
            <p className="font-machine text-[10px] tracking-[0.1em] text-slate uppercase">{group}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                const checked = permissions.includes(p.key);
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => toggle(p.key)}
                    className={[
                      "flex items-center gap-1.5 border px-2.5 py-1 text-[11.5px]",
                      checked ? "border-signal bg-signal/10 text-signal" : "border-rule text-slate hover:text-ink",
                    ].join(" ")}
                  >
                    {checked && <Check className="size-[11px]" strokeWidth={3} />}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="mt-4" disabled={submitting}>
        {submitting ? "Creating…" : "Create role"}
      </Button>
    </form>
  );
}

function RolesPage() {
  const [customRoles, setCustomRoles] = useState<CustomRole[] | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const { custom } = await listRoles();
    setCustomRoles(custom);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    await deleteRole(id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <Card className="p-0">
        <div className="border-b border-rule px-5 py-3">
          <p className="text-[13px] font-semibold text-ink">Built-in roles</p>
        </div>
        {BUILT_IN_ROLES.map((r) => (
          <BuiltInRoleCard key={r.id} role={r} />
        ))}
      </Card>

      <Card className="mt-6 p-0">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <p className="text-[13px] font-semibold text-ink">Custom roles</p>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-[14px]" /> New role
            </Button>
          )}
        </div>

        {creating && (
          <CreateRoleForm
            onCreated={() => {
              setCreating(false);
              refresh();
            }}
          />
        )}

        <div className="divide-y divide-rule">
          {customRoles === null && <p className="px-5 py-6 text-[13px] text-slate">Loading…</p>}
          {customRoles?.length === 0 && !creating && (
            <p className="px-5 py-6 text-[13px] text-slate">No custom roles yet.</p>
          )}
          {customRoles?.map((role) => (
            <div key={role.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="text-[13.5px] font-medium text-ink">{role.name}</p>
                <p className="text-[12px] text-slate">{role.permissions.length} permissions</p>
              </div>
              <button
                onClick={() => handleDelete(role.id)}
                className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5 text-[12px] font-medium text-slate hover:border-verdict-block/40 hover:text-verdict-block"
              >
                <Trash2 className="size-[13px]" /> Delete
              </button>
            </div>
          ))}
        </div>

        {customRoles !== null && customRoles.length > 0 && (
          <p className="border-t border-rule px-5 py-3 text-[12px] text-slate">
            Deleting a role moves anyone holding it to Viewer — nobody is left without access.
          </p>
        )}
      </Card>
    </div>
  );
}
