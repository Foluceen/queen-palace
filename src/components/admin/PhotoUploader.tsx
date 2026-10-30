"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { Media } from "@/lib/types";
import { ACCEPTED_IMAGE_TYPES, MediaPicker, MediaThumb, readImageFile } from "./MediaPicker";

interface Props {
  /** Photos currently attached, in display order (first = main photo). */
  value: Media[];
  onChange(next: Media[]): void;
  /** Used as the photo description (alt text) so the owner never has to type one. */
  describeAs: string;
  /** One photo only (e.g. a collection image). */
  single?: boolean;
  disabled?: boolean;
}

interface Pending {
  key: string;
  name: string;
  error?: string;
}

/**
 * Add photos straight from the phone or computer: tap or drag them in. Each photo is resized,
 * uploaded and described automatically (alt text = the product or collection name). The photo
 * library is still available as a secondary choice.
 */
export function PhotoUploader({ value, onChange, describeAs, single = false, disabled = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const busy = pending.some((p) => !p.error);

  const alt = describeAs.trim() || "Queen Luxury Hair product photo";

  const upload = async (files: File[]) => {
    const list = single ? files.slice(0, 1) : files;
    if (!list.length) return;
    const jobs = list.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name }));
    setPending((p) => [...p, ...jobs]);
    const added: Media[] = [];
    // One at a time keeps phone uploads reliable on slow connections.
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!;
      const job = jobs[i]!;
      try {
        const img = await readImageFile(file);
        const m = await api().call(
          "adminUploadMedia",
          { body: { fileName: img.fileName, mimeType: img.mimeType, sizeBytes: img.sizeBytes, width: img.width, height: img.height, alt: alt, tags: [], dataUrl: img.dataUrl } },
          { timeoutMs: 60_000 },
        );
        added.push(m);
        setPending((p) => p.filter((x) => x.key !== job.key));
      } catch (err) {
        setPending((p) => p.map((x) => (x.key === job.key ? { ...x, error: errorMessage(err) } : x)));
      }
    }
    if (added.length) onChange(single ? added.slice(0, 1) : [...value, ...added]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const makeMain = (i: number) => {
    if (i <= 0) return;
    const next = [...value];
    const [m] = next.splice(i, 1);
    onChange([m!, ...next]);
  };

  // Drag to reorder: works with a mouse (grab the photo) and fingers (grab the handle).
  // The list re-orders live while dragging and is handed back on release.
  const [dragging, setDragging] = useState<{ id: string; order: Media[] } | null>(null);
  const shown = dragging?.order ?? value;
  const startDrag = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (disabled || single || value.length < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ id, order: value });
  };
  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-photo-id]");
    const overId = over?.dataset.photoId;
    if (!overId || overId === dragging.id) return;
    const from = dragging.order.findIndex((m) => m.id === dragging.id);
    const to = dragging.order.findIndex((m) => m.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...dragging.order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    setDragging({ ...dragging, order: next });
  };
  const endDrag = () => {
    if (!dragging) return;
    const changed = dragging.order.some((m, i) => m.id !== value[i]?.id);
    setDragging(null);
    if (changed) onChange(dragging.order);
  };
  const place = (i: number) => (i === 0 ? "Main photo" : `${i + 1}${["st", "nd", "rd"][i] ?? "th"}`);

  const canAdd = !disabled && (!single || value.length === 0);

  return (
    <div className="aphotos">
      {value.length ? (
        <>
          {!single && value.length > 1 && !disabled ? <p className="small muted aphotos__help">Drag a photo to change the order. The first one is the main photo customers see.</p> : null}
          <ul className={`aphotos__grid ${dragging ? "is-sorting" : ""}`}>
            {shown.map((m, i) => (
              <li
                key={m.id}
                className={`aphotos__item ${dragging?.id === m.id ? "is-dragging" : ""}`}
                data-photo-id={m.id}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div className="aphotos__card" onPointerDown={(e) => e.pointerType === "mouse" && startDrag(e, m.id)}>
                  <MediaThumb media={m} size={150} />
                  {!single ? <span className={`aphotos__main ${i === 0 ? "" : "is-other"}`}>{place(i)}</span> : null}
                  {!single && !disabled && value.length > 1 ? (
                    <button
                      type="button"
                      className="aphotos__grip"
                      aria-label={`Drag to move photo ${i + 1}`}
                      onPointerDown={(e) => startDrag(e, m.id)}
                      onKeyDown={(e) => {
                        const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
                        if (dir) {
                          e.preventDefault();
                          move(i, dir);
                        }
                      }}
                    >
                      <Icon name="grip" size={18} />
                    </button>
                  ) : null}
                </div>
                {!disabled ? (
                  <div className="aphotos__tools">
                    {!single ? (
                      <>
                        <button type="button" className="icon-btn" disabled={i === 0} aria-label="Move left" onClick={() => move(i, -1)}>
                          <Icon name="chevronLeft" size={16} />
                        </button>
                        <button type="button" className="icon-btn" disabled={i === value.length - 1} aria-label="Move right" onClick={() => move(i, 1)}>
                          <Icon name="chevronRight" size={16} />
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => onChange(value.filter((x) => x.id !== m.id))}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ) : null}
                {!single && !disabled && i > 0 ? (
                  <button type="button" className="link-btn small aphotos__make-main" onClick={() => makeMain(i)}>
                    Make main photo
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pending.length ? (
        <ul className="aphotos__pending" aria-live="polite">
          {pending.map((p) => (
            <li key={p.key} className={p.error ? "is-error" : ""}>
              {p.error ? (
                <>
                  <span>
                    <strong>{p.name}</strong> couldn&apos;t be added: {p.error}
                  </span>
                  <button type="button" className="link-btn small" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <span className="spinner" aria-hidden /> Adding {p.name}…
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <div
          className={`aphotos__drop ${dragOver ? "is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
          }}
        >
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple={!single}
            className="sr-only"
            aria-label={single ? "Add a photo" : "Add photos"}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void upload(files);
            }}
          />
          <button type="button" className="btn btn--lg aphotos__add" onClick={() => input.current?.click()} disabled={busy && single}>
            <Icon name="plus" size={20} />
            {single ? "Add a photo" : value.length ? "Add more photos" : "Add photos"}
          </button>
          <p className="small muted">
            Tap to choose from your phone or computer{single ? "" : ", or drag photos here"}. Big photos are made smaller automatically.
          </p>
          <button type="button" className="link-btn small" onClick={() => setLibraryOpen(true)}>
            Or pick a photo you already uploaded
          </button>
        </div>
      ) : null}

      <MediaPicker
        open={libraryOpen}
        multiple={!single}
        selectedIds={value.map((m) => m.id)}
        onClose={() => setLibraryOpen(false)}
        onSelect={(m) => onChange(single ? m.slice(0, 1) : [...value, ...m.filter((x) => !value.some((v) => v.id === x.id))])}
      />
    </div>
  );
}
