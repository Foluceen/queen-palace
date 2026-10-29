"use client";

import { useRef, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { MediaThumb, readImageFile, type PreparedImage } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, Empty, LoadError, LoadingRows, PageHeader, Sheet } from "@/components/admin/ui";
import { TextField } from "@/components/ui/Field";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { Media } from "@/lib/types";

interface PendingUpload {
  file: File;
  /** What will actually be uploaded (resized and re-encoded when the original is large). */
  image: PreparedImage;
  preview: string;
  width: number;
  height: number;
  alt: string;
  tags: string;
}

export default function MediaPage() {
  const toast = useToast();
  const { can } = useAdmin();
  const canWrite = can("media:write");
  const [q, setQ] = useState("");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListMedia", { query: { q: q || undefined } }), [q]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Media | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTags, setEditTags] = useState("");

  return (
    <RequirePermission permission="products:read">
      <PageHeader
        title="Media library"
        description="Product, collection and homepage images. Alt text is read aloud to customers using screen readers."
        actions={
          canWrite ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                id="media-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const img = await readImageFile(file);
                    setPending({ file, image: img, preview: img.dataUrl, width: img.width, height: img.height, alt: "", tags: "" });
                  } catch (err) {
                    toast(errorMessage(err), "danger");
                  }
                }}
              />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                Upload image
              </button>
            </>
          ) : null
        }
      />
      <div className="afilters">
        <input className="input" type="search" placeholder="Search alt text or tags" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows rows={3} /> : null}
      {data ? (
        data.length ? (
          <ul className="amedia-grid">
            {data.map((m) => (
              <li key={m.id} className="amedia-card">
                <MediaThumb media={m} size={180} />
                <div className="amedia-card__body">
                  <p className="small">{m.alt || <span className="notice--warning">Missing alt text</span>}</p>
                  <p className="small muted">
                    {m.width}×{m.height}, {formatDate(m.createdAt)}
                  </p>
                  {canWrite ? (
                    <div className="cluster">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setEditing(m);
                          setEditAlt(m.alt);
                          setEditTags(m.tags.join(", "));
                        }}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        title="Delete this image?"
                        body="Images used by a product or collection can't be deleted until you remove them there."
                        confirmLabel="Delete image"
                        danger
                        onConfirm={async () => {
                          try {
                            await api().call("adminDeleteMedia", { params: { id: m.id } });
                            setData((list) => list?.filter((x) => x.id !== m.id) ?? null);
                            toast("Image deleted");
                          } catch (err) {
                            toast(errorMessage(err), "danger");
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title={q ? "No images match" : "No images yet"} body={q ? undefined : "Upload product photos to use them across the store."} />
        )
      ) : null}

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Upload image"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={uploading || !pending?.alt.trim()}
              onClick={async () => {
                if (!pending) return;
                setUploading(true);
                try {
                  const m = await api().call("adminUploadMedia", {
                    body: { fileName: pending.image.fileName, mimeType: pending.image.mimeType, sizeBytes: pending.image.sizeBytes, width: pending.width, height: pending.height, alt: pending.alt.trim(), tags: pending.tags.split(",").map((t) => t.trim()).filter(Boolean), dataUrl: pending.preview },
                  }, { timeoutMs: 60_000 });
                  setData((list) => [m, ...(list ?? [])]);
                  setPending(null);
                  toast("Image uploaded");
                } catch (err) {
                  toast(errorMessage(err), "danger");
                } finally {
                  setUploading(false);
                }
              }}
            >
              {uploading ? <span className="spinner" aria-hidden /> : null}
              Upload
            </button>
          </>
        }
      >
        {pending ? (
          <div className="astack">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.preview} alt="" className="aupload-preview" />
            <p className="small muted">
              {pending.file.name}, {pending.width}×{pending.height}, {(pending.file.size / 1024 / 1024).toFixed(1)} MB. Portrait 4:5 photos at 1200px wide or more look best.
            </p>
            <TextField label="Alt text" value={pending.alt} onChange={(e) => setPending({ ...pending, alt: e.target.value })} required hint='Describe the hair, e.g. "16 inch 1B bone straight frontal unit, side view"' />
            <TextField label="Tags" value={pending.tags} onChange={(e) => setPending({ ...pending, tags: e.target.value })} hint="Comma-separated, to help you find it later." />
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit image details"
        footer={
          <button
            type="button"
            className="btn"
            onClick={async () => {
              if (!editing) return;
              try {
                const m = await api().call("adminUpdateMedia", { params: { id: editing.id }, body: { alt: editAlt.trim(), tags: editTags.split(",").map((t) => t.trim()).filter(Boolean) } });
                setData((list) => list?.map((x) => (x.id === m.id ? m : x)) ?? null);
                setEditing(null);
                toast("Image details saved");
              } catch (err) {
                toast(errorMessage(err), "danger");
              }
            }}
          >
            Save details
          </button>
        }
      >
        {editing ? (
          <div className="astack">
            <MediaThumb media={editing} size={220} />
            <TextField label="Alt text" value={editAlt} onChange={(e) => setEditAlt(e.target.value)} />
            <TextField label="Tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>
        ) : null}
      </Sheet>
    </RequirePermission>
  );
}
