/**
 * Hash router for the single-file preview build. Real app paths ("/products/x?variant=1")
 * map to artifact-safe hashes ("#product--x"): ASCII letters, digits and hyphens only.
 * Query strings are kept in memory (and remembered per hash for the back button).
 */
import { useSyncExternalStore } from "react";

export interface Loc {
  path: string;
  query: string;
  scroll: boolean;
  seq: number;
}

const enc = (seg: string) => seg.replace(/-/g, "-h-").replace(/_/g, "-u-").replace(/[^A-Za-z0-9-]/g, (c) => `-x${c.charCodeAt(0).toString(16)}-`);
const dec = (seg: string) =>
  seg
    .replace(/-x([0-9a-f]+)-/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/-u-/g, "_")
    .replace(/-h-/g, "-");

export function pathToHash(path: string): string {
  const clean = path.split("?")[0]!.replace(/\/+$/, "") || "/";
  if (clean === "/") return "home";
  return "p--" + clean.slice(1).split("/").map(enc).join("--");
}

export function hashToPath(hash: string): string {
  const h = hash.replace(/^#/, "");
  if (!h || h === "home" || !h.startsWith("p--")) return "/";
  return "/" + h.slice(3).split("--").map(dec).join("/");
}

const rememberedQuery = new Map<string, string>();
let loc: Loc = { path: hashToPath(location.hash), query: "", scroll: true, seq: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function navigate(href: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const [rawPath, query = ""] = href.split("?");
  const path = (rawPath || "/").replace(/\/+$/, "") || "/";
  const hash = pathToHash(path);
  rememberedQuery.set(hash, query);
  loc = { path, query, scroll: opts.scroll !== false, seq: loc.seq + 1 };
  if (location.hash.replace(/^#/, "") !== hash) {
    try {
      if (opts.replace) history.replaceState(history.state, "", `#${hash}`);
      else location.hash = hash;
    } catch {
      /* hash updates can be refused in some frames; in-memory routing still works */
    }
  }
  emit();
}

export function refresh() {
  loc = { ...loc, scroll: false, seq: loc.seq + 1 };
  emit();
}

window.addEventListener("hashchange", () => {
  const path = hashToPath(location.hash);
  if (path === loc.path) return;
  loc = { path, query: rememberedQuery.get(location.hash.replace(/^#/, "")) ?? "", scroll: true, seq: loc.seq + 1 };
  emit();
});

/* Intercept plain anchors and GET forms that point at app paths. */
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a");
  const href = a?.getAttribute("href");
  if (!a || !href || !href.startsWith("/")) return;
  e.preventDefault();
  navigate(href);
});
document.addEventListener("submit", (e) => {
  const form = e.target as HTMLFormElement;
  const action = form.getAttribute("action");
  if (e.defaultPrevented || !action || !action.startsWith("/") || (form.method || "get").toLowerCase() !== "get") return;
  e.preventDefault();
  const qs = new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
  navigate(qs ? `${action}?${qs}` : action);
});

export const getLoc = () => loc;
export function useLoc(): Loc {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => loc,
  );
}
