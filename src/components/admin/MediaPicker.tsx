"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import type { Media } from "@/lib/types";
import { useResource } from "./hooks";
import { LoadError, LoadingRows } from "./ui";

/** Image types the backend accepts. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
/** Largest original we try to shrink in the browser (phone photos are often 3–10 MB). */
export const MAX_SOURCE_BYTES = 20_000_000;
/** The backend's own per-image limit. */
export const MAX_IMAGE_BYTES = 3_000_000;
/**
 * Upload budget for the encoded image. The upload is base64 JSON (about 4/3 of the bytes), and the
 * API's nginx proxy rejects request bodies over 1 MB with a 413 that browsers report as a network
 * error. 700 KB keeps the whole request under that with room to spare.
 */
export const UPLOAD_BUDGET_BYTES = 700_000;
/** Longest side after resizing; plenty for product photos (the storefront serves resized copies). */
export const MAX_DIMENSION = 2000;

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(blob);
  });

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release(): void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* fall back to an <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't an image we can read."));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

/**
 * Prepares an image for upload: checks the type, then (only when needed) resizes to at most
 * MAX_DIMENSION and re-encodes as WebP (JPEG where WebP encoding isn't available) until it fits
 * UPLOAD_BUDGET_BYTES. Small images that already fit are sent unchanged.
 */
export async function readImageFile(file: File): Promise<PreparedImage> {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) throw new Error("Use a JPEG, PNG, WebP, or AVIF image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is over 20 MB. Please choose a smaller photo.");
  const img = await decode(file);
  try {
    if (file.size <= UPLOAD_BUDGET_BYTES && Math.max(img.width, img.height) <= MAX_DIMENSION) {
      return { dataUrl: await toDataUrl(file), width: img.width, height: img.height, mimeType: file.type, sizeBytes: file.size, fileName: file.name };
    }
    const base = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare images for upload.");
    for (const scale of [1, 0.85, 0.7, 0.55, 0.4]) {
      const w = Math.max(1, Math.round(img.width * base * scale));
      const h = Math.max(1, Math.round(img.height * base * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img.source, 0, 0, w, h);
      for (const quality of [0.86, 0.78, 0.7]) {
        let blob = await encode(canvas, "image/webp", quality);
        if (!blob || blob.type !== "image/webp") {
          // No WebP encoder (older Safari): JPEG on a white background (JPEG has no transparency).
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
          blob = await encode(canvas, "image/jpeg", quality);
        }
        if (blob && blob.size <= UPLOAD_BUDGET_BYTES) {
          const ext = blob.type === "image/webp" ? "webp" : "jpg";
          return { dataUrl: await toDataUrl(blob), width: w, height: h, mimeType: blob.type, sizeBytes: blob.size, fileName: file.name.replace(/\.[^.]+$/, "") + "." + ext };
        }
      }
    }
    throw new Error("We couldn't make this image small enough to upload. Please try a different photo.");
  } finally {
    img.release();
  }
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

