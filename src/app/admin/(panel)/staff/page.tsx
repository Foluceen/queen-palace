"use client";

import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, LoadError, LoadingRows, PageHeader, Panel, Sheet, StatusBadge } from "@/components/admin/ui";
import { SelectField, TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS, type Permission, type Role, type StaffInvitation } from "@/lib/types";

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

/** Plain-English messages for the server's staff rules. */
function staffError(err: unknown): string {
  if (err instanceof ApiError && err.code === "account_owner_protected") return "The account owner can't be suspended, removed or changed.";
  if (err instanceof ApiError && err.code === "owner_management_forbidden") return "Only the account owner can add or manage Owners.";
  return errorMessage(err);
}

export default function StaffPage() {
  const toast = useToast();
  const { session } = useAdmin();
  const staff = useResource(() => api().call("adminListStaff"));
  const roles = useResource(() => api().call("adminListRoles"));
  const [invite, setInvite] = useState<{ name: string; email: string; roleId: string } | null>(null);
  const [link, setLink] = useState<{ name: string; email: string; url: string; expiresAt: string; emailed: boolean } | null>(null);
  // The token goes in the #fragment: browsers never send it to any server or log.
  const showLink = (s: { name: string; email: string }, invitation: StaffInvitation) =>
    setLink({ name: s.name || s.email, email: s.email, url: `${window.location.origin}/admin/invite#token=${encodeURIComponent(invitation.token)}`, expiresAt: invitation.expiresAt, emailed: invitation.emailed === true });
  const [role, setRole] = useState<RoleDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const roleName = (id: string) => roles.data?.find((r) => r.id === id)?.name ?? "Unknown role";
  // Default new people to a role that can actually do something (a role with no permissions
  // would let them sign in and see nothing).
  const defaultRoleId = () => {
    const list = roles.data?.filter((r) => iAmAccountOwner || !(r.id === "owner" || r.system)) ?? [];
    return (list.find((r) => !r.system && r.permissions.length > 1) ?? list.find((r) => r.system) ?? list[0])?.id ?? "";
  };
  const emptyRole = (id: string) => (roles.data?.find((r) => r.id === id)?.permissions.length ?? 1) <= 1;
  // Account-owner rules (enforced by the server; this only hides what you can't do).
  const iAmAccountOwner = session.staff.isAccountOwner === true;
  const isOwnerRole = (id: string) => id === "owner" || roles.data?.find((r) => r.id === id)?.system === true;
  const canManage = (p: { id: string; roleId: string; isAccountOwner?: boolean }) => p.id !== session.staff.id && !p.isAccountOwner && (!isOwnerRole(p.roleId) || iAmAccountOwner);
  const assignableRoles = roles.data?.filter((r) => iAmAccountOwner || !isOwnerRole(r.id)) ?? [];

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader
        title="Staff"
        description="People who can sign in here, and what each one is allowed to do."
        actions={
          <button type="button" className="btn" onClick={() => setInvite({ name: "", email: "", roleId: defaultRoleId() })}>
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
                      const manageable = canManage(p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="atable__primary">
                              {p.name}
                              {me ? " (you)" : ""}
                            </span>
                            {p.isAccountOwner ? <span className="badge badge--accent">Account owner</span> : null}
                            <span className="small muted block">{p.email}</span>
                            {p.lastActiveAt ? <span className="small muted block">Active {formatDateTime(p.lastActiveAt)}</span> : null}
                          </td>
                          <td>
                            <select
                              className="select select--sm"
                              value={p.roleId}
                              disabled={!manageable}
                              aria-label={`Role for ${p.name}`}
                              onChange={async (e) => {
                                try {
                                  const updated = await api().call("adminUpdateStaff", { params: { id: p.id }, body: { roleId: e.target.value } });
                                  staff.setData((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
                                  toast(`${p.name} is now ${roleName(updated.roleId)}`);
                                } catch (err) {
                                  toast(staffError(err), "danger");
                                }
                              }}
                            >
                              {(manageable ? assignableRoles : (roles.data ?? [])).map((r) => (
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
                            {manageable ? (
                              <div className="cluster" style={{ ["--cluster" as string]: "6px" }}>
                                {p.status === "invited" ? (
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={async () => {
                                      try {
                                        const { invitation } = await api().call("adminReissueStaffInvite", { params: { id: p.id } });
                                        showLink(p, invitation);
                                      } catch (err) {
                                        const missing = err instanceof ApiError && (err.status === 405 || err.status === 501 || (err.status === 404 && err.code !== "not_found"));
                                        toast(missing ? "New invite links need a server update. Ask Hermes to add it." : errorMessage(err), "danger");
                                      }
                                    }}
                                  >
                                    New invite link
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={async () => {
                                    try {
                                      const updated = await api().call("adminUpdateStaff", { params: { id: p.id }, body: { status: p.status === "suspended" ? "active" : "suspended" } });
                                      staff.setData((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
                                      toast(updated.status === "suspended" ? `${p.name} suspended` : `${p.name} reactivated`);
                                    } catch (err) {
                                      toast(staffError(err), "danger");
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
                                      // Show what the server really did: reload rather than assume.
                                      const fresh = await api().call("adminListStaff");
                                      staff.setData(fresh);
                                      const still = fresh.find((x) => x.id === p.id);
                                      if (still) toast(`${p.name} can no longer sign in (status: ${still.status}). Deleting them for good needs a server update; ask Hermes.`, "danger");
                                      else toast(`${p.name} removed`);
                                    } catch (err) {
                                      toast(staffError(err), "danger");
                                    }
                                  }}
                                />
                              </div>
                            ) : !me ? (
                              <span className="small muted">{p.isAccountOwner ? "Protected" : "Only the account owner can manage Owners"}</span>
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
                const { invitation, ...s } = await api().call("adminInviteStaff", { body: invite });
                staff.setData((list) => [...(list ?? []).filter((x) => x.id !== s.id), s]);
                setInvite(null);
                if (invitation?.token) showLink(s, invitation);
                else toast(invitation?.emailed ? `Invite emailed to ${s.email}` : `${s.email} invited.`);
              } catch (err) {
                const existing = staff.data?.find((x) => x.email.toLowerCase() === invite.email.trim().toLowerCase());
                toast(
                  err instanceof ApiError && err.status === 409
                    ? existing?.status === "invited"
                      ? `${invite.email} is already invited. Use "New invite link" next to their name.`
                      : `${invite.email} already has an account here (${existing?.status ?? "existing"}). Removing them for good needs a server update; ask Hermes.`
                    : errorMessage(err),
                  "danger",
                );
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
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.permissions.length <= 1 ? " (can't see anything yet)" : ""}
                </option>
              ))}
            </SelectField>
            {!iAmAccountOwner ? <p className="small muted">Only the account owner can invite Owners.</p> : null}
            {emptyRole(invite.roleId) ? (
              <p className="notice notice--warning small">This role has no permissions yet, so this person would sign in and see nothing. Choose Owner, or edit the role first.</p>
            ) : null}
            <p className="small muted">We&apos;ll email them a link to set their own password. You&apos;ll also get the link to send yourself.</p>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={!!link} onClose={() => setLink(null)} title="Send the invite link">
        {link ? (
          <div className="astack">
            {link.emailed ? (
              <p className="notice notice--success">
                Invite emailed to <strong>{link.email}</strong>. They open the email and set their own password.
              </p>
            ) : (
              <p className="notice notice--warning">Invite emails aren&apos;t switched on yet, so send this link yourself.</p>
            )}
            <p>
              <strong>{link.name}</strong> ({link.email}) can set their own password with this link. If you send it yourself, send it privately, for example on WhatsApp.
            </p>
            <label className="field">
              <span className="field__label">Invite link</span>
              <input className="input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <div className="cluster">
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    toast("Link copied");
                  } catch {
                    toast("Couldn't copy. Select the link and copy it.", "danger");
                  }
                }}
              >
                Copy link
              </button>
              <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(`Your Queen Luxury Hair admin invite. Open this link to set your password: ${link.url}`)}`} target="_blank" rel="noopener noreferrer">
                Send on WhatsApp
              </a>
            </div>
            <p className="small muted">
              The link works once and expires {new Date(link.expiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", timeZone: "Africa/Lagos" })}. Anyone with it can set the password, so only send it to {link.name}. It won&apos;t be shown again: if it&apos;s lost or doesn&apos;t work, use <strong>New invite link</strong> next to their name.
            </p>
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
                    toast(staffError(err), "danger");
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
                  toast(staffError(err), "danger");
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
