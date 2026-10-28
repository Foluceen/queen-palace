"use client";

import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, Empty, LoadError, LoadingRows, PageHeader, Sheet } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { AttributeDefinition, ProductType, ProductTypeInput } from "@/lib/types";

const kindLabel: Record<AttributeDefinition["kind"], string> = { text: "Short text", longtext: "Paragraph", list: "List (one per line)" };
const groupLabel: Record<AttributeDefinition["group"], string> = { details: "Details table", care: "Care section", usage: "How to use" };

/** Field keys are stable identifiers stored with each product's values. */
const toKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);

const blank = (): ProductTypeInput => ({ name: "", description: "", optionNames: [], attributes: [{ key: "", label: "", kind: "text", group: "details" }] });

function ProductTypesInner() {
  const toast = useToast();
  const { can } = useAdmin();
  const canWrite = can("products:write");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListProductTypes"));
  const [draft, setDraft] = useState<ProductTypeInput | null>(null);
  const [optionsText, setOptionsText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const edit = (t?: ProductType) => {
    const d: ProductTypeInput = t ? { id: t.id, name: t.name, description: t.description, optionNames: t.optionNames, attributes: t.attributes } : blank();
    setDraft(d);
    setOptionsText(d.optionNames.join(", "));
    setErrors({});
  };

  const setAttr = (i: number, patch: Partial<AttributeDefinition>) => {
    if (!draft) return;
    setDraft({ ...draft, attributes: draft.attributes.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    const body: ProductTypeInput = {
      ...draft,
      optionNames: optionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      attributes: draft.attributes.filter((a) => a.label.trim()).map((a) => ({ ...a, label: a.label.trim(), key: a.key || toKey(a.label) })),
    };
    try {
      const saved = await api().call("adminSaveProductType", { body });
      setData((list) => (list ? (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]) : [saved]));
      toast(draft.id ? "Product type saved" : "Product type created");
      setDraft(null);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Product types"
        description="Each type decides which fields a product has. Wigs get lace and density, hair care gets size and how to use, and so on. Add a type to sell something new without code changes."
        actions={
          canWrite ? (
            <button type="button" className="btn" onClick={() => edit()}>
              Add product type
            </button>
          ) : null
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <ul className="atypes">
            {data.map((t) => (
              <li key={t.id} className="apanel atype">
                <div className="atype__head">
                  <div>
                    <h2 className="h4">{t.name}</h2>
                    <p className="small muted">{t.description}</p>
                  </div>
                  <span className="small muted">
                    {t.productCount} {t.productCount === 1 ? "product" : "products"}
                  </span>
                </div>
                <ul className="cluster atype__fields">
                  {t.attributes.map((a) => (
                    <li key={a.key} className="chip chip--static">
                      {a.label}
                    </li>
                  ))}
                </ul>
                {t.optionNames.length ? <p className="small muted">Suggested options: {t.optionNames.join(", ")}</p> : null}
                {canWrite ? (
                  <div className="cluster">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => edit(t)}>
                      Edit
                    </button>
                    <ConfirmButton
                      label="Delete"
                      title={`Delete ${t.name}?`}
                      body={t.productCount ? `${t.productCount} products use this type. Move them to another type first.` : "This type isn't used by any product."}
                      confirmLabel="Delete type"
                      danger
                      disabled={t.productCount > 0}
                      onConfirm={async () => {
                        try {
                          await api().call("adminDeleteProductType", { params: { id: t.id } });
                          setData((list) => list?.filter((x) => x.id !== t.id) ?? null);
                          toast(`${t.name} deleted`);
                        } catch (err) {
                          toast(errorMessage(err), "danger");
                        }
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No product types yet" body="Create one to define the fields your products need." />
        )
      ) : null}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.name}` : "New product type"}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" aria-hidden /> : null}
              Save type
            </button>
          </>
        }
      >
        {draft ? (
          <div className="astack">
            <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} error={errors.name} placeholder="e.g. Closure" required />
            <TextAreaField label="Description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <TextField label="Suggested variant options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} hint="Comma separated, e.g. Length, Density. Pre-filled when creating a product of this type." />
            <fieldset className="afieldset">
              <legend className="field__label">Product fields</legend>
              {errors.attributes ? <p className="field__error">{errors.attributes}</p> : null}
              {draft.attributes.map((a, i) => (
                <div key={i} className="aoption-row aoption-row--4">
                  <TextField label="Label" value={a.label} onChange={(e) => setAttr(i, { label: e.target.value, ...(draft.id && a.key ? {} : { key: toKey(e.target.value) }) })} />
                  <SelectField label="Type" value={a.kind} onChange={(e) => setAttr(i, { kind: e.target.value as AttributeDefinition["kind"] })}>
                    {Object.entries(kindLabel).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Shown in" value={a.group} onChange={(e) => setAttr(i, { group: e.target.value as AttributeDefinition["group"] })}>
                    {Object.entries(groupLabel).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </SelectField>
                  <button type="button" className="icon-btn" aria-label={`Remove ${a.label || "field"}`} onClick={() => setDraft({ ...draft, attributes: draft.attributes.filter((_, j) => j !== i) })}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft({ ...draft, attributes: [...draft.attributes, { key: "", label: "", kind: "text", group: "details" }] })}>
                Add field
              </button>
              <p className="small muted">Removing a field hides it on the store. Values already saved on products are kept by the backend.</p>
            </fieldset>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

export default function ProductTypesPage() {
  return (
    <RequirePermission permission="products:read">
      <ProductTypesInner />
    </RequirePermission>
  );
}
