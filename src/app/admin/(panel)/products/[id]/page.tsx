"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource, useUnsavedWarning } from "@/components/admin/hooks";
import { MediaPicker, MediaThumb } from "@/components/admin/MediaPicker";
import { PhotoUploader } from "@/components/admin/PhotoUploader";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, LoadError, LoadingRows, MoneyInput, PageHeader, Panel, Switch } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { isMockMode } from "@/lib/api/config";
import { handleFor } from "@/lib/slug";
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
  productTypeId: string | null;
  attributes: Record<string, string>;
  videoUrl: string;
  videoPoster: Media | null;
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
    productTypeId: p.productTypeId,
    attributes: p.attributes,
    videoUrl: p.video?.url ?? "",
    videoPoster: p.video?.poster ?? null,
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
  options: [],
  variants: [],
  productTypeId: null,
  attributes: {},
  videoUrl: "",
  videoPoster: null,
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
  const types = useResource(() => api().call("adminListProductTypes"));
  const [duplicating, setDuplicating] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(isNew ? blank : null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  const selectedType = types.data?.find((t) => t.id === draft.productTypeId) ?? null;

  const chooseType = (typeId: string) => {
    const t = types.data?.find((x) => x.id === typeId);
    const patch: Partial<Draft> = { productTypeId: typeId || null };
    // A new product with no options yet starts with the type's suggested options.
    if (t && !draft.options.some((o) => o.name.trim())) patch.options = t.optionNames.map((name) => ({ name, values: "" }));
    update(patch);
  };

  const duplicate = async () => {
    setDuplicating(true);
    try {
      const copy = await api().call("adminDuplicateProduct", { params: { id } });
      toast("Copy created as a draft with no stock. Check the SKUs and URL before publishing.");
      router.push(`/admin/products/${copy.id}`);
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setDuplicating(false);
    }
  };

  /** SKU stays out of the owner's way: one is made from the web address when left empty. */
  const autoSku = (v: VariantDraft, i: number, handle: string) => {
    if (v.sku.trim()) return v.sku.trim();
    const base = `QLH-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24)}`.replace(/-+$/, "");
    const suffix = Object.values(v.options).map((x) => x.toUpperCase().replace(/[^A-Z0-9]+/g, "")).filter(Boolean).join("-");
    return suffix ? `${base}-${suffix}` : i === 0 ? base : `${base}-${i + 1}`;
  };

  const save = async () => {
    setErrors({});
    setFormError(null);
    // Friendly checks before anything is sent (the store checks again).
    const problems: Record<string, string> = {};
    if (!draft.title.trim()) problems.title = "Give the product a name.";
    if (!draft.variants.length || !draft.variants[0]!.price) problems.price = "Add a price.";
    if (Object.keys(problems).length) {
      setErrors(problems);
      setFormError(problems.title ?? problems.price ?? null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    const handle = handleFor(draft.handle, draft.title);
    const variants = draft.variants.map((v, i) => ({ ...v, sku: autoSku(v, i, handle) }));
    const body: ProductInput = {
      title: draft.title.trim(),
      handle,
      subtitle: draft.subtitle,
      description: draft.description,
      status: draft.status,
      featured: draft.featured,
      collectionIds: draft.collectionIds,
      mediaIds: draft.media.map((m) => m.id),
      options: draft.options.map((o) => ({ name: o.name.trim(), values: parseValues(o.values) })).filter((o) => o.name && o.values.length),
      variants: variants.map((v, i) => ({
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
      productTypeId: draft.productTypeId,
      // Only send the fields the chosen type defines.
      attributes: Object.fromEntries((selectedType?.attributes ?? []).map((a) => [a.key, (draft.attributes[a.key] ?? "").trim()]).filter(([, v]) => v)),
      video: draft.videoUrl.trim() ? { url: draft.videoUrl.trim(), posterId: draft.videoPoster?.id ?? null } : null,
      tags: parseValues(draft.tags),
      seo: { title: draft.seoTitle || undefined, description: draft.seoDescription || undefined },
      // The production backend stores one price and stock per product: mirror the first option.
      ...(variants[0]
        ? {
            price: variants[0].price ?? 0,
            compareAtPrice: variants[0].compareAtPrice,
            sku: variants[0].sku || undefined,
            ...(isNew ? { stock: Math.max(0, Math.trunc(variants[0].available || 0)) } : {}),
          }
        : {}),
    };
    try {
      const saved = isNew ? await api().call("adminCreateProduct", { body }) : await api().call("adminUpdateProduct", { params: { id }, body });
      // Photos uploaded before the product had a name get a proper description now (best effort).
      const name = draft.title.trim();
      void Promise.allSettled(
        draft.media
          .filter((m) => !m.alt || m.alt === "Queen Luxury Hair product photo")
          .map((m) => api().call("adminUpdateMedia", { params: { id: m.id }, body: { alt: name, tags: m.tags ?? [] } })),
      );
      setDirty(false);
      toast(isNew ? (draft.status === "published" ? "Product added and showing in the shop" : "Product saved. It's hidden until you switch on “Show in shop”.") : "Changes saved");
      if (isNew) router.replace(`/admin/products/${saved.id}`);
      else product.setData(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setFormError(errorMessage(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const ro = !canWrite;
  const first = draft.variants[0];
  const hasOptions = optionNames.length > 0;
  const shown = draft.status === "published";

  return (
    <RequirePermission permission="products:read">
      <PageHeader
        back={
          <Link href="/admin/products" className="aback small">
            <Icon name="chevronLeft" size={16} /> All products
          </Link>
        }
        title={isNew ? "Add a product" : draft.title || "Untitled product"}
        description={ro ? "You can look at this product, but your account can't change it." : dirty ? "You have changes that aren't saved yet." : undefined}
        actions={
          !isNew && product.data?.status === "published" ? (
            <Link href={`/products/${product.data.handle}`} className="btn btn--ghost btn--sm" target="_blank">
              See it in the shop
            </Link>
          ) : null
        }
      />
      {formError ? (
        <p className="notice notice--danger" role="alert">
          {formError}
        </p>
      ) : null}

      <fieldset className="asimple" disabled={ro}>
        <Panel title="1. Photos">
          <PhotoUploader value={draft.media} onChange={(media) => update({ media })} describeAs={draft.title} disabled={ro} />
          {!draft.media.length ? <p className="small muted">Tip: 3 or more clear photos (front, side and hairline) help customers decide.</p> : null}
        </Panel>

        <Panel title="2. About this product">
          <div className="astack">
            <TextField label="Product name" value={draft.title} onChange={(e) => update({ title: e.target.value })} error={errors.title} required placeholder="e.g. Bone Straight 20 inch Frontal Wig" />
            <TextField label="One line about it (optional)" value={draft.subtitle} onChange={(e) => update({ subtitle: e.target.value })} placeholder="e.g. 13x4 HD lace, natural black" />
            <TextAreaField label="Description" value={draft.description} onChange={(e) => update({ description: e.target.value })} rows={5} hint="Length, lace, density, how to care for it: anything a customer would ask you." />
          </div>
        </Panel>

        <Panel title="3. Price and stock">
          {hasOptions ? (
            <p className="small muted">This product has sizes or colours, so prices and stock are set for each one under “More options” below.</p>
          ) : first ? (
            <div className="aprice-grid">
              <div className="field">
                <label className="field__label" htmlFor="price">
                  Price (₦)
                </label>
                <MoneyInput id="price" value={first.price} onChange={(k) => setVariant(0, { price: k })} invalid={!!errors.price} ariaLabel="Price in naira" />
                {errors.price ? <p className="field__error">{errors.price}</p> : null}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="old-price">
                  Old price (optional)
                </label>
                <MoneyInput id="old-price" value={first.compareAtPrice} onChange={(k) => setVariant(0, { compareAtPrice: k })} placeholder="" ariaLabel="Old price in naira" />
                <p className="field__hint">If higher than the price, the shop shows a “Sale” label.</p>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="stock">
                  How many do you have?
                </label>
                {first.existingStock ? (
                  <p className="astock-now">
                    <strong>{first.available}</strong> in stock ·{" "}
                    <Link href={`/admin/inventory?q=${encodeURIComponent(first.sku || draft.title)}`}>Change stock</Link>
                  </p>
                ) : (
                  <input id="stock" className="input" type="number" inputMode="numeric" min={0} value={first.available} onChange={(e) => setVariant(0, { available: Math.max(0, Number(e.target.value) || 0) })} />
                )}
                <p className="field__hint">When this reaches 0 the shop shows “Sold out”.</p>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="4. Show in shop">
          <div className="ashow">
            <Switch checked={shown} onChange={(v) => update({ status: v ? "published" : "draft" })} label={shown ? "Customers can see and buy this product" : "Hidden from customers"} />
            <p className="small muted">{shown ? "It appears in the shop as soon as you save." : "Switch this on when the product is ready to sell."}</p>
          </div>
        </Panel>

        <Panel title="5. Collections">
          {collections.data ? (
            collections.data.length ? (
              <ul className="achecks achecks--big">
                {collections.data.map((c: Collection) => (
                  <li key={c.id}>
                    <label className="checkbox">
                      <input type="checkbox" checked={draft.collectionIds.includes(c.id)} onChange={(e) => update({ collectionIds: e.target.checked ? [...draft.collectionIds, c.id] : draft.collectionIds.filter((x) => x !== c.id) })} />
                      {c.title}
                      {c.status !== "published" ? <span className="small muted"> (hidden)</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">
                No collections yet. <Link href="/admin/collections">Create one</Link> (for example “Frontal wigs”) to group products in the shop.
              </p>
            )
          ) : collections.error ? (
            <LoadError message={`Collections couldn't be loaded: ${collections.error}`} onRetry={() => void collections.reload()} />
          ) : (
            <LoadingRows rows={3} />
          )}
        </Panel>

        <details className="amore">
          <summary>
            <span>More options</span>
            <span className="small muted">Sizes and colours, product type, video, web address, homepage feature</span>
          </summary>
          <div className="amore__body">
            <Panel title="Sizes, lengths or colours" actions={<span className="small muted">Separate values with commas, e.g. 16&quot;, 18&quot;, 20&quot;</span>}>
              <div className="astack">
                {draft.options.map((o, i) => (
                  <div key={i} className="aoption-row">
                    <TextField label="Name" value={o.name} onChange={(e) => update({ options: draft.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Length" />
                    <TextField label="Choices" value={o.values} onChange={(e) => update({ options: draft.options.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)) })} placeholder='16", 18", 20"' />
                    <button type="button" className="icon-btn" aria-label={`Remove ${o.name || "option"}`} onClick={() => update({ options: draft.options.filter((_, j) => j !== i) })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                {draft.options.length < 3 ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => update({ options: [...draft.options, { name: "", values: "" }] })}>
                    <Icon name="plus" size={16} /> Add sizes or colours
                  </button>
                ) : null}
                {!isMockMode && draft.variants.length > 1 ? (
                  <p className="notice notice--warning small" role="status">
                    The store currently saves one price and stock per product (the first row below). Until that&apos;s updated, add each size as its own product.
                  </p>
                ) : null}
              </div>
              {hasOptions ? (
                <div className="atable-wrap">
                  <table className="atable atable--edit">
                    <thead>
                      <tr>
                        <th scope="col">Choice</th>
                        <th scope="col">Price (₦)</th>
                        <th scope="col">Old price</th>
                        <th scope="col">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((v, i) => (
                        <tr key={v.key}>
                          <th scope="row">{optionNames.map((n) => v.options[n]).join(" / ")}</th>
                          <td>
                            <MoneyInput value={v.price} onChange={(k) => setVariant(i, { price: k })} ariaLabel="Price" invalid={!!errors[`variants.${i}.price`]} />
                          </td>
                          <td>
                            <MoneyInput value={v.compareAtPrice} onChange={(k) => setVariant(i, { compareAtPrice: k })} ariaLabel="Old price" placeholder="" />
                          </td>
                          <td>
                            {v.existingStock ? (
                              <span className="small">{v.available}</span>
                            ) : (
                              <input className="input input--sm" type="number" inputMode="numeric" min={0} value={v.available} onChange={(e) => setVariant(i, { available: Math.max(0, Number(e.target.value) || 0) })} aria-label="Stock" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Panel>

            <Panel title="Product type and details">
              <div className="astack">
                <SelectField label="Product type" value={draft.productTypeId ?? ""} onChange={(e) => chooseType(e.target.value)} error={errors.productTypeId} hint="Adds the right detail fields, e.g. lace and density for wigs.">
                  <option value="">None</option>
                  {(types.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectField>
                {types.error ? (
                  <div className="notice notice--warning small" role="status">
                    <span>Product types couldn&apos;t be loaded ({types.error}). You can still save this product without a type.</span>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => void types.reload()}>
                      Try again
                    </button>
                  </div>
                ) : null}
                {selectedType?.attributes.map((a) =>
                  a.kind === "text" ? (
                    <TextField key={a.key} label={a.label} value={draft.attributes[a.key] ?? ""} placeholder={a.placeholder} onChange={(e) => update({ attributes: { ...draft.attributes, [a.key]: e.target.value } })} />
                  ) : (
                    <TextAreaField
                      key={a.key}
                      label={a.label}
                      rows={a.kind === "list" ? 4 : 3}
                      value={draft.attributes[a.key] ?? ""}
                      placeholder={a.placeholder}
                      hint={a.kind === "list" ? "One per line." : undefined}
                      onChange={(e) => update({ attributes: { ...draft.attributes, [a.key]: e.target.value } })}
                    />
                  ),
                )}
              </div>
            </Panel>

            <Panel title="Video (optional)">
              <div className="astack">
                <TextField label="Video link" type="url" value={draft.videoUrl} onChange={(e) => update({ videoUrl: e.target.value })} error={errors.video} placeholder="https://…/video.mp4" hint="A link to an MP4 video file." />
                {draft.videoUrl ? (
                  <div className="cluster">
                    {draft.videoPoster ? <MediaThumb media={draft.videoPoster} size={64} /> : null}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPosterOpen(true)}>
                      {draft.videoPoster ? "Change cover photo" : "Choose cover photo"}
                    </button>
                  </div>
                ) : null}
                <MediaPicker open={posterOpen} onClose={() => setPosterOpen(false)} onSelect={(m) => update({ videoPoster: m[0] ?? null })} />
              </div>
            </Panel>

            <Panel title="Homepage, search and web address">
              <div className="astack">
                <Switch checked={draft.featured} onChange={(v) => update({ featured: v })} label="Feature on the homepage" />
                <TextField label="Web address" value={draft.handle} onChange={(e) => update({ handle: e.target.value })} error={errors.handle} hint={`queenluxuryhair.store/products/${handleFor(draft.handle, draft.title) || "made-from-the-name"}. Made from the name if left empty.`} />
                <TextField label="Search words (optional)" value={draft.tags} onChange={(e) => update({ tags: e.target.value })} hint="Separate with commas, e.g. frontal, straight, 20 inch" />
                <TextField label="Stock code (optional)" value={first?.sku ?? ""} onChange={(e) => setVariant(0, { sku: e.target.value })} hint="Made automatically if left empty." />
                <TextField label="Title on Google (optional)" value={draft.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} />
                <TextAreaField label="Description on Google (optional)" value={draft.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} rows={2} />
                <SelectField label="Status" value={draft.status} onChange={(e) => update({ status: e.target.value as PublishStatus })} hint="Archived products are hidden and kept for your records.">
                  <option value="published">Showing in shop</option>
                  <option value="draft">Hidden</option>
                  <option value="archived">Archived</option>
                </SelectField>
              </div>
            </Panel>

            {!isNew && canWrite ? (
              <Panel title="Copy or delete">
                <div className="cluster">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={duplicate} disabled={duplicating || dirty} title={dirty ? "Save your changes first" : undefined}>
                    {duplicating ? <span className="spinner" aria-hidden /> : <Icon name="copy" size={16} />}
                    Make a copy
                  </button>
                  <ConfirmButton
                    label="Delete product"
                    title={`Delete ${draft.title}?`}
                    body="Past orders keep their details. If you might sell it again, switch off “Show in shop” instead."
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
                </div>
              </Panel>
            ) : null}
          </div>
        </details>

        {canWrite ? (
          <div className="asavebar">
            <span className="small muted">{dirty ? "Changes not saved yet" : isNew ? "Fill in the steps above" : "All changes saved"}</span>
            <button type="button" className="btn btn--lg" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" aria-hidden /> : <Icon name="check" size={18} />}
              {isNew ? "Save product" : "Save changes"}
            </button>
          </div>
        ) : null}
      </fieldset>
    </RequirePermission>
  );
}
