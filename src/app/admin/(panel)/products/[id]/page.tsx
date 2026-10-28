"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { MediaPicker, MediaThumb } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Collection, Kobo, Media, Product, ProductInput, PublishStatus, Variant } from "@/lib/types";

interface OptionDraft {
  name: string;
  values: string;
}
interface VariantDraft {
  id?: string;
  key: string;
  options: Record<string, string>;
  sku: string;
  price: Kobo | null;
  compareAtPrice: Kobo | null;
  available: number;
  tracked: boolean;
  policy: "deny" | "continue";
  lowStockThreshold: number;
  mediaId: string | null;
  existingStock: boolean;
}
interface Draft {
  title: string;
  handle: string;
  subtitle: string;
  description: string;
  status: PublishStatus;
  featured: boolean;
  collectionIds: string[];
  media: Media[];
  options: OptionDraft[];
  variants: VariantDraft[];
  specs: { label: string; value: string }[];
  careNotes: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
}

const keyOf = (o: Record<string, string>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
const parseValues = (s: string) => [...new Set(s.split(",").map((v) => v.trim()).filter(Boolean))];

function cartesian(options: { name: string; values: string[] }[]): Record<string, string>[] {
  const valid = options.filter((o) => o.name.trim() && o.values.length);
  if (!valid.length) return [{}];
  return valid.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name.trim()]: v }))), [{}]);
}

function variantDraft(v: Variant): VariantDraft {
  return { id: v.id, key: keyOf(v.options), options: v.options, sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice, available: v.inventory.available, tracked: v.inventory.tracked, policy: v.inventory.policy, lowStockThreshold: v.inventory.lowStockThreshold, mediaId: v.mediaId, existingStock: true };
}

function fromProduct(p: Product): Draft {
  return {
    title: p.title,
    handle: p.handle,
    subtitle: p.subtitle,
    description: p.description,
    status: p.status,
    featured: p.featured,
    collectionIds: p.collectionIds,
    media: p.media,
    options: p.options.map((o) => ({ name: o.name, values: o.values.join(", ") })),
    variants: p.variants.map(variantDraft),
    specs: p.specs,
    careNotes: p.careNotes.join("\n"),
    tags: p.tags.join(", "),
    seoTitle: p.seo.title ?? "",
    seoDescription: p.seo.description ?? "",
  };
}

const blank: Draft = {
  title: "",
  handle: "",
  subtitle: "",
  description: "",
  status: "draft",
  featured: false,
  collectionIds: [],
  media: [],
  options: [{ name: "Length", values: "" }],
  variants: [],
  specs: [],
  careNotes: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
};

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();
  const { can } = useAdmin();
  const canWrite = can("products:write");
  const product = useResource(() => (isNew ? Promise.resolve(null) : api().call("adminGetProduct", { params: { id } })), [id]);
  const collections = useResource(() => api().call("adminListCollections"));
  const [draft, setDraft] = useState<Draft | null>(isNew ? blank : null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (product.data) setDraft(fromProduct(product.data));
  }, [product.data]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  // Keep the variant matrix in step with the options, preserving existing rows.
  const optionSignature = draft ? JSON.stringify(draft.options.map((o) => [o.name.trim(), parseValues(o.values)])) : "";
  useEffect(() => {
    if (!draft) return;
    const combos = cartesian(draft.options.map((o) => ({ name: o.name, values: parseValues(o.values) })));
    const existing = new Map(draft.variants.map((v) => [v.key, v]));
    const template = draft.variants[0];
    const next = combos.map((options) => {
      const k = keyOf(options);
      return (
        existing.get(k) ?? {
          key: k,
          options,
          sku: "",
          price: template?.price ?? null,
          compareAtPrice: null,
          available: 0,
          tracked: true,
          policy: "deny" as const,
          lowStockThreshold: 3,
          mediaId: null,
          existingStock: false,
        }
      );
    });
    const same = next.length === draft.variants.length && next.every((v, i) => v === draft.variants[i]);
    if (!same) setDraft((d) => (d ? { ...d, variants: next } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionSignature]);

  const setVariant = (i: number, patch: Partial<VariantDraft>) => {
    setDraft((d) => (d ? { ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) } : d));
    setDirty(true);
  };

  const optionNames = useMemo(() => draft?.options.filter((o) => o.name.trim() && parseValues(o.values).length).map((o) => o.name.trim()) ?? [], [draft?.options]);

  if (product.error) return <LoadError message={product.error} onRetry={product.reload} />;
  if (!draft) return <LoadingRows rows={8} />;

  const save = async () => {
    setSaving(true);
    setErrors({});
    setFormError(null);
    const body: ProductInput = {
      title: draft.title,
      handle: draft.handle,
      subtitle: draft.subtitle,
      description: draft.description,
      status: draft.status,
      featured: draft.featured,
      collectionIds: draft.collectionIds,
      mediaIds: draft.media.map((m) => m.id),
      options: draft.options.map((o) => ({ name: o.name.trim(), values: parseValues(o.values) })).filter((o) => o.name && o.values.length),
      variants: draft.variants.map((v, i) => ({
        id: v.id,
        sku: v.sku,
        title: Object.values(v.options).join(" / ") || "Default",
        options: v.options,
        price: v.price ?? 0,
        compareAtPrice: v.compareAtPrice,
        mediaId: v.mediaId,
        position: i,
        inventory: { tracked: v.tracked, policy: v.policy, lowStockThreshold: v.lowStockThreshold, available: v.available },
      })),
      specs: draft.specs,
      careNotes: draft.careNotes.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: parseValues(draft.tags),
      seo: { title: draft.seoTitle || undefined, description: draft.seoDescription || undefined },
    };
    try {
      const saved = isNew ? await api().call("adminCreateProduct", { body }) : await api().call("adminUpdateProduct", { params: { id }, body });
      setDirty(false);
      toast(isNew ? "Product created" : "Product saved");
      if (isNew) router.replace(`/admin/products/${saved.id}`);
      else product.setData(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const ro = !canWrite;

  return (
    <RequirePermission permission="products:read">
      <PageHeader
        back={
          <Link href="/admin/products" className="aback small">
            <Icon name="chevronLeft" size={16} /> Products
          </Link>
        }
        title={isNew ? "Add product" : draft.title || "Untitled product"}
        description={ro ? "You can view this product. Your role can't edit it." : dirty ? "You have unsaved changes." : undefined}
        actions={
          <>
            {!isNew && product.data?.status === "published" ? (
              <Link href={`/products/${product.data.handle}`} className="btn btn--ghost btn--sm" target="_blank">
                View in store
              </Link>
            ) : null}
            {canWrite ? (
              <button type="button" className="btn" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" aria-hidden /> : null}
                {isNew ? "Create product" : "Save changes"}
              </button>
            ) : null}
          </>
        }
      />
      {formError ? (
        <p className="notice notice--danger" role="alert">
          {formError}
        </p>
      ) : null}

      <fieldset className="aeditor" disabled={ro}>
        <div className="aeditor__main">
          <Panel title="Details">
            <div className="astack">
              <TextField label="Name" value={draft.title} onChange={(e) => update({ title: e.target.value })} error={errors.title} required />
              <TextField label="Short description" value={draft.subtitle} onChange={(e) => update({ subtitle: e.target.value })} hint="Shown under the name, e.g. 13x4 lace front, 1B natural" />
              <TextAreaField label="Description" value={draft.description} onChange={(e) => update({ description: e.target.value })} rows={5} />
            </div>
          </Panel>

          <Panel
            title="Images"
            actions={
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPickerOpen(true)}>
                Add images
              </button>
            }
          >
            {draft.media.length ? (
              <ul className="amedia-order">
                {draft.media.map((m, i) => (
                  <li key={m.id}>
                    <MediaThumb media={m} size={96} />
                    <span className="small">{i === 0 ? "Main image" : `Image ${i + 1}`}</span>
                    <div className="cluster" style={{ ["--cluster" as string]: "4px" }}>
                      <button type="button" className="icon-btn" disabled={i === 0} aria-label="Move earlier" onClick={() => update({ media: draft.media.map((x, j) => (j === i - 1 ? m : j === i ? draft.media[i - 1]! : x)) })}>
                        <Icon name="chevronLeft" size={16} />
                      </button>
                      <button type="button" className="icon-btn" disabled={i === draft.media.length - 1} aria-label="Move later" onClick={() => update({ media: draft.media.map((x, j) => (j === i + 1 ? m : j === i ? draft.media[i + 1]! : x)) })}>
                        <Icon name="chevronRight" size={16} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Remove image" onClick={() => update({ media: draft.media.filter((x) => x.id !== m.id) })}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No images yet. Products with three or more images sell better.</p>
            )}
            <MediaPicker open={pickerOpen} multiple selectedIds={draft.media.map((m) => m.id)} onClose={() => setPickerOpen(false)} onSelect={(m) => update({ media: [...draft.media, ...m] })} />
          </Panel>

          <Panel title="Options" actions={<span className="small muted">Comma-separate values, e.g. 16&quot;, 18&quot;, 20&quot;</span>}>
            <div className="astack">
              {draft.options.map((o, i) => (
                <div key={i} className="aoption-row">
                  <TextField label="Option" value={o.name} onChange={(e) => update({ options: draft.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Length" />
                  <TextField label="Values" value={o.values} onChange={(e) => update({ options: draft.options.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)) })} placeholder='16", 18", 20"' />
                  <button type="button" className="icon-btn" aria-label={`Remove option ${o.name}`} onClick={() => update({ options: draft.options.filter((_, j) => j !== i) })}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              {draft.options.length < 3 ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ options: [...draft.options, { name: "", values: "" }] })}>
                  Add option
                </button>
              ) : null}
              <p className="small muted">Length uses the measuring-tape selector in the store. Colour shows shade swatches for codes like 1B, 27 and 613.</p>
            </div>
          </Panel>

          <Panel title={`Variants (${draft.variants.length})`}>
            {errors.variants ? <p className="field__error">{errors.variants}</p> : null}
            <div className="atable-wrap">
              <table className="atable atable--edit">
                <thead>
                  <tr>
                    <th scope="col">Variant</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Price</th>
                    <th scope="col">Compare at</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Track</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.variants.map((v, i) => (
                    <tr key={v.key}>
                      <th scope="row">{optionNames.length ? optionNames.map((n) => v.options[n]).join(" / ") : "Default"}</th>
                      <td>
                        <input className="input input--sm" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} aria-label="SKU" aria-invalid={!!errors[`variants.${i}.sku`] || undefined} />
                      </td>
                      <td>
                        <MoneyInput value={v.price} onChange={(k) => setVariant(i, { price: k })} ariaLabel="Price" invalid={!!errors[`variants.${i}.price`]} />
                      </td>
                      <td>
                        <MoneyInput value={v.compareAtPrice} onChange={(k) => setVariant(i, { compareAtPrice: k })} ariaLabel="Compare-at price" placeholder="" />
                      </td>
                      <td>
                        {v.existingStock ? (
                          <Link href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="small">
                            {v.available} in stock
                          </Link>
                        ) : (
                          <input className="input input--sm" type="number" min={0} value={v.available} onChange={(e) => setVariant(i, { available: Math.max(0, Number(e.target.value) || 0) })} aria-label="Starting stock" />
                        )}
                      </td>
                      <td>
                        <input type="checkbox" checked={v.tracked} onChange={(e) => setVariant(i, { tracked: e.target.checked })} aria-label="Track stock" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.keys(errors).some((k) => k.startsWith("variants.")) ? <p className="field__error">Every variant needs a SKU and a price above ₦0.</p> : null}
            <p className="small muted">Prices are what customers pay, in naira. Existing stock is changed from Inventory so every change is recorded.</p>
          </Panel>

          <Panel
            title="Hair details"
            actions={
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ specs: [...draft.specs, { label: "", value: "" }] })}>
                Add detail
              </button>
            }
          >
            <div className="astack">
              {draft.specs.map((s, i) => (
                <div key={i} className="aoption-row">
                  <TextField label="Label" value={s.label} onChange={(e) => update({ specs: draft.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Lace" />
                  <TextField label="Value" value={s.value} onChange={(e) => update({ specs: draft.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="13x4 HD frontal" />
                  <button type="button" className="icon-btn" aria-label="Remove detail" onClick={() => update({ specs: draft.specs.filter((_, j) => j !== i) })}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <TextAreaField label="Care notes" value={draft.careNotes} onChange={(e) => update({ careNotes: e.target.value })} hint="One tip per line." rows={4} />
            </div>
          </Panel>
        </div>

        <aside className="aeditor__side">
          <Panel title="Status">
            <div className="astack">
              <SelectField label="Visibility" value={draft.status} onChange={(e) => update({ status: e.target.value as PublishStatus })} hint={draft.status === "published" ? "Visible in the store." : draft.status === "draft" ? "Hidden until you publish it." : "Hidden and kept for records."}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </SelectField>
              <Switch checked={draft.featured} onChange={(v) => update({ featured: v })} label="Feature on the homepage" />
            </div>
          </Panel>
          <Panel title="Collections">
            {collections.data ? (
              <ul className="achecks">
                {collections.data.map((c: Collection) => (
                  <li key={c.id}>
                    <label className="checkbox">
                      <input type="checkbox" checked={draft.collectionIds.includes(c.id)} onChange={(e) => update({ collectionIds: e.target.checked ? [...draft.collectionIds, c.id] : draft.collectionIds.filter((x) => x !== c.id) })} />
                      {c.title}
                      {c.status !== "published" ? <span className="small muted"> ({c.status})</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <LoadingRows rows={3} />
            )}
          </Panel>
          <Panel title="Search and URL">
            <div className="astack">
              <TextField label="URL handle" value={draft.handle} onChange={(e) => update({ handle: e.target.value })} error={errors.handle} hint={`/products/${draft.handle || "made-from-name"}`} />
              <TextField label="Tags" value={draft.tags} onChange={(e) => update({ tags: e.target.value })} hint="Comma-separated. Used in search." />
              <TextField label="Search title" value={draft.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} />
              <TextAreaField label="Search description" value={draft.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} rows={3} />
            </div>
          </Panel>
          {!isNew && canWrite ? (
            <Panel title="Delete">
              <p className="small muted">Archiving keeps order history tidy. Delete only if this was added by mistake.</p>
              <ConfirmButton
                label="Delete product"
                title={`Delete ${draft.title}?`}
                body="This removes the product and its variants. Past orders keep their line details."
                confirmLabel="Delete product"
                danger
                className="btn btn--ghost btn--sm"
                onConfirm={async () => {
                  try {
                    await api().call("adminDeleteProduct", { params: { id } });
                    setDirty(false);
                    toast("Product deleted");
                    router.replace("/admin/products");
                  } catch (err) {
                    toast(errorMessage(err), "danger");
                  }
                }}
              />
            </Panel>
          ) : null}
        </aside>
      </fieldset>
    </RequirePermission>
  );
}
