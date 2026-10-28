"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, Empty, LoadError, LoadingRows, MoneyInput, PageHeader, Sheet, StatusBadge, Switch } from "@/components/admin/ui";
import { SelectField, TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatDate, formatNaira } from "@/lib/format";
import type { Discount, DiscountInput, DiscountKind } from "@/lib/types";

type Draft = DiscountInput & { id?: string };

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const blank = (): Draft => ({ code: "", title: "", kind: "percentage", value: 10, minSubtotal: null, appliesTo: { type: "all" }, startsAt: new Date().toISOString(), endsAt: null, usageLimit: null, oncePerCustomer: false, status: "active" });

const describe = (d: Discount) => (d.kind === "percentage" ? `${d.value}% off` : d.kind === "fixed_amount" ? `${formatNaira(d.value)} off` : "Free delivery");
const tone = (s: Discount["status"]) => (s === "active" ? "success" : s === "scheduled" ? "info" : s === "expired" ? "neutral" : "warning");

export default function DiscountsPage() {
  const toast = useToast();
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListDiscounts"));
  const collections = useResource(() => api().call("adminListCollections"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    const { id, ...body } = draft;
    try {
      const saved = id ? await api().call("adminUpdateDiscount", { params: { id }, body }) : await api().call("adminCreateDiscount", { body });
      setData((list) => (id ? list?.map((x) => (x.id === id ? saved : x)) : [saved, ...(list ?? [])]) ?? null);
      setDraft(null);
      toast(id ? `${saved.code} saved` : `${saved.code} created`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequirePermission permission="discounts:write">
      <PageHeader
        title="Discounts"
        description="Codes customers enter at checkout. The backend checks eligibility and calculates every discount."
        actions={
          <button type="button" className="btn" onClick={() => setDraft(blank())}>
            Create discount
          </button>
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <div className="atable-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Offer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dates</th>
                  <th scope="col" className="num">
                    Used
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="atable__primary mono">{d.code}</span>
                      <span className="small muted block">{d.title}</span>
                    </td>
                    <td className="small">
                      {describe(d)}
                      {d.minSubtotal ? <span className="muted block">Orders over {formatNaira(d.minSubtotal)}</span> : null}
                      {d.appliesTo.type === "collections" ? <span className="muted block">Selected collections only</span> : null}
                    </td>
                    <td>
                      <StatusBadge tone={tone(d.status)}>{d.status[0]!.toUpperCase() + d.status.slice(1)}</StatusBadge>
                    </td>
                    <td className="small">
                      {formatDate(d.startsAt)}
                      {d.endsAt ? ` to ${formatDate(d.endsAt)}` : ", no end date"}
                    </td>
                    <td className="num">
                      {d.usageCount}
                      {d.usageLimit ? ` / ${d.usageLimit}` : ""}
                    </td>
                    <td>
                      <div className="cluster" style={{ ["--cluster" as string]: "6px" }}>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setDraft({ id: d.id, code: d.code, title: d.title, kind: d.kind, value: d.value, minSubtotal: d.minSubtotal, appliesTo: d.appliesTo, startsAt: d.startsAt, endsAt: d.endsAt, usageLimit: d.usageLimit, oncePerCustomer: d.oncePerCustomer, status: d.status === "disabled" ? "disabled" : "active" })}
                        >
                          Edit
                        </button>
                        <ConfirmButton
                          label="Delete"
                          title={`Delete ${d.code}?`}
                          body="Customers will no longer be able to use this code. Past orders keep their discount."
                          confirmLabel="Delete code"
                          danger
                          onConfirm={async () => {
                            try {
                              await api().call("adminDeleteDiscount", { params: { id: d.id } });
                              setData((list) => list?.filter((x) => x.id !== d.id) ?? null);
                              toast(`${d.code} deleted`);
                            } catch (err) {
                              toast(errorMessage(err), "danger");
                            }
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No discounts yet" body="Create a code for a launch, a holiday, or your WhatsApp followers." />
        )
      ) : null}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.code}` : "New discount"}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" aria-hidden /> : null}
              {draft?.id ? "Save discount" : "Create discount"}
            </button>
          </>
        }
      >
        {draft ? (
          <div className="astack">
            <TextField label="Code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} error={errors.code} hint="What customers type, e.g. GLOW15" />
            <TextField label="Internal name" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <SelectField label="Type" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DiscountKind, value: e.target.value === "percentage" ? 10 : 0 })}>
              <option value="percentage">Percentage off</option>
              <option value="fixed_amount">Fixed amount off</option>
              <option value="free_shipping">Free delivery</option>
            </SelectField>
            {draft.kind === "percentage" ? <TextField label="Percentage" type="number" min={1} max={100} value={String(draft.value)} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} error={errors.value} /> : null}
            {draft.kind === "fixed_amount" ? (
              <label className="field">
                <span className="field__label">Amount off</span>
                <MoneyInput value={draft.value} onChange={(v) => setDraft({ ...draft, value: v ?? 0 })} invalid={!!errors.value} />
                {errors.value ? <span className="field__error">{errors.value}</span> : null}
              </label>
            ) : null}
            <label className="field">
              <span className="field__label">Minimum order (optional)</span>
              <MoneyInput value={draft.minSubtotal} onChange={(v) => setDraft({ ...draft, minSubtotal: v })} placeholder="No minimum" />
            </label>
            <SelectField
              label="Applies to"
              value={draft.appliesTo.type}
              onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value === "collections" ? { type: "collections", ids: [] } : { type: "all" } })}
            >
              <option value="all">Everything</option>
              <option value="collections">Selected collections</option>
            </SelectField>
            {draft.appliesTo.type === "collections" ? (
              <ul className="achecks">
                {collections.data?.map((c) => {
                  const ids = draft.appliesTo.type === "collections" ? draft.appliesTo.ids : [];
                  return (
                    <li key={c.id}>
                      <label className="checkbox">
                        <input type="checkbox" checked={ids.includes(c.id)} onChange={(e) => setDraft({ ...draft, appliesTo: { type: "collections", ids: e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id) } })} />
                        {c.title}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="form-grid">
              <TextField label="Starts" type="datetime-local" value={toLocal(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: fromLocal(e.target.value) ?? new Date().toISOString() })} />
              <TextField label="Ends (optional)" type="datetime-local" value={toLocal(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: fromLocal(e.target.value) })} error={errors.endsAt} />
            </div>
            <TextField label="Total uses allowed (optional)" type="number" min={1} value={draft.usageLimit === null ? "" : String(draft.usageLimit)} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value ? Number(e.target.value) : null })} />
            <Switch checked={draft.oncePerCustomer} onChange={(v) => setDraft({ ...draft, oncePerCustomer: v })} label="One use per customer" />
            <Switch checked={draft.status === "active"} onChange={(v) => setDraft({ ...draft, status: v ? "active" : "disabled" })} label="Code can be used" />
          </div>
        ) : null}
      </Sheet>
    </RequirePermission>
  );
}
