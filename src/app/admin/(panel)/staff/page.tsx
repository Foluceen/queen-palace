"use client";

import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, LoadError, LoadingRows, PageHeader, Panel, Sheet, StatusBadge } from "@/components/admin/ui";
import { SelectField, TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS, type Permission, type Role } from "@/lib/types";

const permissionLabel: Record<Permission, string> = {
  "dashboard:read": "See the dashboard",
  "products:read": "View products and stock",
  "products:write": "Edit products and prices",
  "collections:write": "Edit collections",
  "inventory:write": "Adjust stock",
  "media:write": "Upload and delete images",
  "orders:read": "View orders",
  "customers:read": "View customers and their order history",
  "analytics:read": "See sales analytics",
  "orders:write": "Fulfil, cancel and confirm transfers",
  "orders:refund": "Issue refunds",
  "content:write": "Edit homepage, menus and pages",
  "discounts:write": "Manage discount codes",
  "reviews:moderate": "Approve reviews",
  "inquiries:respond": "Reply to messages",
  "settings:write": "Change shipping, payments and branding",
  "staff:manage": "Manage staff and roles",
};

type RoleDraft = { id?: string; name: string; description: string; permissions: Permission[] };

export default function StaffPage() {
  const toast = useToast();
  const { session } = useAdmin();
  const staff = useResource(() => api().call("adminListStaff"));
  const roles = useResource(() => api().call("adminListRoles"));
  const [invite, setInvite] = useState<{ name: string; email: string; roleId: string } | null>(null);
  const [role, setRole] = useState<RoleDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const roleName = (id: string) => roles.data?.find((r) => r.id === id)?.name ?? "Unknown role";

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader
        title="Staff and roles"
        description="Roles decide what each person sees here. The backend checks the same permissions on every request."
        actions={
          <button type="button" className="btn" onClick={() => setInvite({ name: "", email: "", roleId: roles.data?.find((r) => !r.system)?.id ?? "" })}>
            Invite staff
          </button>
        }
      />
      {staff.error ? <LoadError message={staff.error} onRetry={staff.reload} /> : null}
      <div className="aeditor">
        <div className="aeditor__main">
          <Panel title="People">
            {!staff.data ? (
              <LoadingRows rows={3} />
            ) : (
              <div className="atable-wrap">
                <table className="atable">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.data.map((p) => {
                      const me = p.id === session.staff.id;
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="atable__primary">
                              {p.name}
                              {me ? " (you)" : ""}
                            </span>
                            <span className="small muted block">{p.email}</span>
                            {p.lastActiveAt ? <span className="small muted block">Active {formatDateTime(p.lastActiveAt)}</span> : null}
                          </td>
                          <td>
                            <select
                              className="select select--sm"
                              value={p.roleId}
                              disabled={me}
                              aria-label={`Role for ${p.name}`}
                              onChange={async (e) => {
                                try {
                                  const updated = await api().call("adminUpdateStaff", { params: { id: p.id }, body: { roleId: e.target.value } });
                                  staff.setData((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
                                  toast(`${p.name} is now ${roleName(updated.roleId)}`);
                                } catch (err) {
                                  toast(errorMessage(err), "danger");
                                }
                              }}
                            >
                              {roles.data?.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <StatusBadge tone={p.status === "active" ? "success" : p.status === "invited" ? "info" : "danger"}>{p.status}</StatusBadge>
                          </td>
                          <td>
                            {!me ? (
                              <div className="cluster" style={{ ["--cluster" as string]: "6px" }}>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={async () => {
                                    try {
                                      const updated = await api().call("adminUpdateStaff", { params: { id: p.id }, body: { status: p.status === "suspended" ? "active" : "suspended" } });
                                      staff.setData((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
                                      toast(updated.status === "suspended" ? `${p.name} suspended` : `${p.name} reactivated`);
                                    } catch (err) {
                                      toast(errorMessage(err), "danger");
                                    }
                                  }}
                                >
                                  {p.status === "suspended" ? "Reactivate" : "Suspend"}
                                </button>
                                <ConfirmButton
                                  label="Remove"
                                  title={`Remove ${p.name}?`}
                                  body="They lose access immediately. Their past actions stay in order history."
                                  confirmLabel="Remove access"
                                  danger
                                  onConfirm={async () => {
                                    try {
                                      await api().call("adminRemoveStaff", { params: { id: p.id } });
                                      staff.setData((list) => list?.filter((x) => x.id !== p.id) ?? null);
                                      toast(`${p.name} removed`);
                                    } catch (err) {
                                      toast(errorMessage(err), "danger");
                                    }
                                  }}
                                />
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
        <aside className="aeditor__side">
          <Panel
            title="Roles"
            actions={
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRole({ name: "", description: "", permissions: ["dashboard:read"] })}>
                New role
              </button>
            }
          >
            {!roles.data ? (
              <LoadingRows rows={3} />
            ) : (
              <ul className="aroles">
                {roles.data.map((r: Role) => (
                  <li key={r.id}>
                    <div>
                      <p className="atable__primary">{r.name}</p>
                      <p className="small muted">
                        {r.description} {r.permissions.length} permissions.
                      </p>
                    </div>
                    {r.system ? (
                      <span className="badge">Fixed</span>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRole({ id: r.id, name: r.name, description: r.description, permissions: r.permissions })}>
                        Edit
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      <Sheet
        open={!!invite}
        onClose={() => setInvite(null)}
        title="Invite staff"
        footer={
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              if (!invite) return;
              setBusy(true);
              try {
                const s = await api().call("adminInviteStaff", { body: invite });
                staff.setData((list) => [...(list ?? []), s]);
                setInvite(null);
                toast(`${s.email} invited. Mock mode doesn't send the invite email.`);
              } catch (err) {
                toast(errorMessage(err), "danger");
              } finally {
                setBusy(false);
              }
            }}
          >
            Send invite
          </button>
        }
      >
        {invite ? (
          <div className="astack">
            <TextField label="Name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            <TextField label="Email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required />
            <SelectField label="Role" value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={!!role}
        onClose={() => setRole(null)}
        title={role?.id ? `Edit ${role.name}` : "New role"}
        footer={
          <>
            {role?.id ? (
              <ConfirmButton
                label="Delete role"
                title={`Delete ${role.name}?`}
                body="Move everyone off this role first."
                confirmLabel="Delete role"
                danger
                onConfirm={async () => {
                  try {
                    await api().call("adminDeleteRole", { params: { id: role.id! } });
                    roles.setData((list) => list?.filter((x) => x.id !== role.id) ?? null);
                    setRole(null);
                    toast("Role deleted");
                  } catch (err) {
                    toast(errorMessage(err), "danger");
                  }
                }}
              />
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (!role) return;
                setBusy(true);
                try {
                  const saved = await api().call("adminSaveRole", { body: role });
                  roles.setData((list) => (role.id ? list?.map((x) => (x.id === saved.id ? saved : x)) : [...(list ?? []), saved]) ?? null);
                  setRole(null);
                  toast(`${saved.name} saved`);
                } catch (err) {
                  toast(errorMessage(err), "danger");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save role
            </button>
          </>
        }
      >
        {role ? (
          <div className="astack">
            <TextField label="Role name" value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} />
            <TextField label="Description" value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} />
            <fieldset className="afieldset">
              <legend className="field__label">What this role can do</legend>
              <ul className="achecks">
                {PERMISSIONS.map((p) => (
                  <li key={p}>
                    <label className="checkbox">
                      <input type="checkbox" checked={role.permissions.includes(p)} onChange={(e) => setRole({ ...role, permissions: e.target.checked ? [...role.permissions, p] : role.permissions.filter((x) => x !== p) })} />
                      {permissionLabel[p]}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        ) : null}
      </Sheet>
    </RequirePermission>
  );
}
