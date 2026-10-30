"use client";

import Link from "next/link";
import { useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { MediaThumb } from "@/components/admin/MediaPicker";
import { PhotoUploader } from "@/components/admin/PhotoUploader";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, Empty, LoadError, LoadingRows, PageHeader, Sheet, StatusBadge, Switch } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { handleFor } from "@/lib/slug";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Collection, Media, PublishStatus } from "@/lib/types";

interface Draft {
  id?: string;
  title: string;
  handle: string;
  summary: string;
  description: string;
  status: PublishStatus;
  image: Media | null;
  banner: Media | null;
  seoTitle: string;
  seoDescription: string;
}

const toDraft = (c?: Collection): Draft =>
  c
    ? { id: c.id, title: c.title, handle: c.handle, summary: c.summary, description: c.description, status: c.status, image: c.image, banner: c.banner, seoTitle: c.seo.title ?? "", seoDescription: c.seo.description ?? "" }
    : { title: "", handle: "", summary: "", description: "", status: "draft", image: null, banner: null, seoTitle: "", seoDescription: "" };

const tone = (s: PublishStatus) => (s === "published" ? "success" : s === "draft" ? "warning" : "neutral");

export default function CollectionsAdminPage() {
  const toast = useToast();
  const { can } = useAdmin();
  const canWrite = can("collections:write");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListCollections"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const move = async (index: number, dir: -1 | 1) => {
    if (!data) return;
    const next = [...data];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item!);
    setData(next);
    setReordering(true);
    try {
      setData(await api().call("adminReorderCollections", { body: { ids: next.map((c) => c.id) } }));
    } catch (err) {
      toast(errorMessage(err), "danger");
      void reload();
    } finally {
      setReordering(false);
    }
  };

  const quickStatus = async (c: Collection, status: PublishStatus) => {
    try {
      const updated = await api().call("adminUpdateCollection", { params: { id: c.id }, body: { status } });
      setData((list) => list?.map((x) => (x.id === c.id ? updated : x)) ?? null);
      toast(status === "published" ? `${c.title} published` : status === "archived" ? `${c.title} archived` : `${c.title} moved to drafts`);
    } catch (err) {
      toast(errorMessage(err), "danger");
    }
  };

  /** The production API currently ignores collection photos: say so instead of losing them silently. */
  const photoKept = (c: Collection) => !draft?.image || Boolean(c.image);

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setErrors({ title: "Give the collection a name." });
      return;
    }
    setSaving(true);
    setErrors({});
    const body = { title: draft.title, handle: handleFor(draft.handle, draft.title), summary: draft.summary, description: draft.description, status: draft.status, imageId: draft.image?.id ?? null, bannerId: draft.banner?.id ?? null, seo: { title: draft.seoTitle || undefined, description: draft.seoDescription || undefined }, position: 0 };
    try {
      if (draft.id) {
        const { position: _p, ...patch } = body;
        const updated = await api().call("adminUpdateCollection", { params: { id: draft.id }, body: patch });
        setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
        toast(photoKept(updated) ? "Collection saved" : "Collection saved, but the store didn't keep the photo yet. This needs a store update.", photoKept(updated) ? undefined : "danger");
      } else {
        const created = await api().call("adminCreateCollection", { body });
        setData((list) => [...(list ?? []), created]);
        toast(photoKept(created) ? "Collection created" : "Collection created, but the store didn't keep the photo yet. This needs a store update.", photoKept(created) ? undefined : "danger");
      }
      setDraft(null);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else toast(errorMessage(err), "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequirePermission permission="products:read">
      <PageHeader
        title="Collections"
        description="The order here is the order customers see in the menu and on the homepage."
        actions={
          canWrite ? (
            <button type="button" className="btn" onClick={() => setDraft(toDraft())}>
              Add collection
            </button>
          ) : null
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <ol className={`acoll-list ${reordering ? "is-pending" : ""}`}>
            {data.map((c, i) => (
              <li key={c.id} className="acoll">
                {canWrite ? (
                  <div className="acoll__order">
                    <button type="button" className="icon-btn" onClick={() => void move(i, -1)} disabled={i === 0 || reordering} aria-label={`Move ${c.title} up`}>
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => void move(i, 1)} disabled={i === data.length - 1 || reordering} aria-label={`Move ${c.title} down`}>
                      <Icon name="arrowDown" size={16} />
                    </button>
                  </div>
                ) : null}
                {c.image ? <MediaThumb media={c.image} size={56} /> : <span className="atable__noimg" />}
                <div className="acoll__text">
                  <p className="atable__primary">{c.title}</p>
                  <p className="small muted">
                    {c.productCount} published products, /collections/{c.handle}
                  </p>
                </div>
                <StatusBadge tone={tone(c.status)}>{c.status[0]!.toUpperCase() + c.status.slice(1)}</StatusBadge>
                <div className="cluster acoll__actions">
                  {c.status === "published" ? (
                    <Link href={`/collections/${c.handle}`} target="_blank" className="btn btn--ghost btn--sm">
                      View
                    </Link>
                  ) : null}
                  {canWrite ? (
                    <>
                      {c.status !== "published" ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void quickStatus(c, "published")}>
                          Publish
                        </button>
                      ) : (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void quickStatus(c, "archived")}>
                          Archive
                        </button>
                      )}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft(toDraft(c))}>
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        title={`Delete ${c.title}?`}
                        body={
                          <>
                            <p>Products are never deleted with a collection. They stay in your catalog and are only removed from {c.title}.</p>
                            <p>Products that belong to no other collection will be listed under the &ldquo;No collection&rdquo; filter on the Products page so you can reassign them. Links to /collections/{c.handle} will stop working.</p>
                          </>
                        }
                        confirmLabel="Delete collection"
                        danger
                        onConfirm={async () => {
                          try {
                            const res = await api().call("adminDeleteCollection", { params: { id: c.id } });
                            setData((list) => list?.filter((x) => x.id !== c.id) ?? null);
                            const n = res.unassignedProductIds.length;
                            toast(n ? `${c.title} deleted. ${n} product${n === 1 ? " is" : "s are"} now in no collection: see Products, filter "No collection".` : `${c.title} deleted. No products were left without a collection.`);
                          } catch (err) {
                            toast(errorMessage(err), "danger");
                          }
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No collections yet" body="Collections group products in the store menu and homepage." />
        )
      ) : null}

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.title}` : "New collection"}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? <span className="spinner" aria-hidden /> : null}
              {draft?.id ? "Save collection" : "Create collection"}
            </button>
          </>
        }
      >
        {draft ? (
          <div className="astack">
            <TextField label="Collection name" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} error={errors.title} required placeholder="e.g. Frontal wigs" />
            <div className="field">
              <span className="field__label">Photo</span>
              <PhotoUploader single value={draft.image ? [draft.image] : []} onChange={(m) => setDraft({ ...draft, image: m[0] ?? null })} describeAs={draft.title ? `${draft.title} collection` : ""} />
            </div>
            <div className="ashow">
              <Switch
                checked={draft.status === "published"}
                onChange={(v) => setDraft({ ...draft, status: v ? "published" : "draft" })}
                label={draft.status === "published" ? "Showing in the shop" : "Hidden from customers"}
              />
            </div>
            <TextField label="One line about it (optional)" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="e.g. Ready-to-wear frontal units" />
            <TextAreaField label="Description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} />
            <details className="amore">
              <summary>
                <span>More options</span>
                <span className="small muted">Wide banner, web address, Google text</span>
              </summary>
              <div className="amore__body astack">
                <div className="field">
                  <span className="field__label">Wide banner (optional)</span>
                  <PhotoUploader single value={draft.banner ? [draft.banner] : []} onChange={(m) => setDraft({ ...draft, banner: m[0] ?? null })} describeAs={draft.title ? `${draft.title} banner` : ""} />
                  <p className="field__hint">Shown at the top of the collection page. Without one, the photo above is used.</p>
                </div>
                <TextField label="Web address" value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} error={errors.handle} hint={`queenluxuryhair.store/collections/${handleFor(draft.handle, draft.title) || "made-from-the-name"}`} />
                <SelectField label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as PublishStatus })}>
                  <option value="published">Showing in shop</option>
                  <option value="draft">Hidden</option>
                  <option value="archived">Archived</option>
                </SelectField>
                <TextField label="Title on Google (optional)" value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} />
                <TextAreaField label="Description on Google (optional)" value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} rows={2} />
              </div>
            </details>
          </div>
        ) : null}
      </Sheet>
    </RequirePermission>
  );
}
