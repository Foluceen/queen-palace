"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import type { Media } from "@/lib/types";
import { useResource } from "./hooks";
import { LoadError, LoadingRows } from "./ui";

/** Reads an image file into what the upload endpoint needs (dimensions + data URL). */
export async function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = dataUrl;
  });
  return { dataUrl, width, height };
}

export function MediaThumb({ media, size = 72 }: { media: Media; size?: number }) {
  return <Image src={media.url} alt={media.alt} width={size} height={Math.round((size * 5) / 4)} className="amedia-thumb" unoptimized={media.url.startsWith("data:")} />;
}

/** Dialog for choosing images from the library. */
export function MediaPicker({ open, onClose, onSelect, multiple = false, selectedIds = [] }: { open: boolean; onClose(): void; onSelect(media: Media[]): void; multiple?: boolean; selectedIds?: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useResource(() => (open ? api().call("adminListMedia", { query: { q: q || undefined } }) : Promise.resolve(null)), [open, q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setPicked([]);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="adialog adialog--lg"
      aria-label="Choose images"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="adialog__body">
        <div className="apanel__head">
          <h2 className="adialog__title">Choose {multiple ? "images" : "an image"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <input className="input" type="search" placeholder="Search alt text or tags" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
        {error ? <LoadError message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingRows rows={2} /> : null}
        {data ? (
          <ul className="amedia-grid amedia-grid--pick">
            {data.map((m) => {
              const already = selectedIds.includes(m.id);
              const on = picked.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`amedia-pick ${on ? "is-on" : ""}`}
                    aria-pressed={on}
                    disabled={already}
                    onClick={() => setPicked((p) => (multiple ? (on ? p.filter((x) => x !== m.id) : [...p, m.id]) : [m.id]))}
                  >
                    <MediaThumb media={m} size={140} />
                    <span className="small">{already ? "Already added" : m.alt || "No alt text"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="small muted">Need a new image? Upload it in the media library first.</p>
        <div className="adialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={!picked.length}
            onClick={() => {
              const chosen = picked.map((id) => data?.find((m) => m.id === id)).filter((m): m is Media => !!m);
              onSelect(chosen);
              onClose();
            }}
          >
            {multiple && picked.length > 1 ? `Add ${picked.length} images` : "Use image"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Single image field with choose/remove. */
export function ImageField({ label, value, onChange, disabled }: { label: string; value: Media | null; onChange(m: Media | null): void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="aimage-field">
        {value ? <MediaThumb media={value} size={96} /> : <span className="aimage-field__empty">No image</span>}
        <div className="cluster">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)} disabled={disabled}>
            {value ? "Replace" : "Choose image"}
          </button>
          {value ? (
            <button type="button" className="link-btn small" onClick={() => onChange(null)} disabled={disabled}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onSelect={(m) => onChange(m[0] ?? null)} />
    </div>
  );
}

