"use client";

/**
 * Thin, lazy wrapper around Anime.js v4. Anime is loaded on first use so it never
 * blocks first paint, and every helper is a no-op when motion should be skipped.
 * All Anime API usage lives in this file, so an API change is a one-file fix.
 */
type AnimeModule = typeof import("animejs");
type Targets = Parameters<AnimeModule["animate"]>[0];
type Params = Parameters<AnimeModule["animate"]>[1];

export interface Controllable {
  pause(): unknown;
}

let modPromise: Promise<AnimeModule> | null = null;
export function loadAnime(): Promise<AnimeModule> {
  if (!modPromise) modPromise = import("animejs");
  return modPromise;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Heuristic for low-end devices or data-saver: skip decorative motion, keep feedback. */
export function isConstrainedDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 2) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return true;
  return false;
}

export type MotionTier = "none" | "essential" | "full";

/** none: reduced motion. essential: feedback only. full: decorative entrances and parallax too. */
export function motionTier(): MotionTier {
  if (typeof document !== "undefined") {
    const preset = document.documentElement.dataset.motion;
    if (preset === "none" || preset === "essential" || preset === "full") {
      // Reduced-motion can change while the page is open; re-check it.
      return prefersReducedMotion() ? "none" : preset;
    }
  }
  if (prefersReducedMotion()) return "none";
  if (isConstrainedDevice()) return "essential";
  return "full";
}

export const ease = {
  out: "outExpo",
  soft: "outQuart",
  inOut: "inOutQuart",
  spring: "outBack(1.4)",
} as const;

/** Runs an Anime animation if the tier allows it. Returns a handle so callers can interrupt it. */
export async function animate(targets: Targets | null | undefined, params: Params, needs: Exclude<MotionTier, "none"> = "full"): Promise<Controllable | null> {
  if (!targets) return null;
  const tier = motionTier();
  if (tier === "none" || (needs === "full" && tier !== "full")) return null;
  const anime = await loadAnime();
  return anime.animate(targets, params) as unknown as Controllable;
}

export async function stagger(value: number, options?: Parameters<AnimeModule["stagger"]>[1]) {
  const anime = await loadAnime();
  return anime.stagger(value, options);
}

/** Stops anything currently animating on these elements, so a new animation can take over. */
export async function interrupt(targets: Targets) {
  if (!modPromise) return;
  const anime = await modPromise;
  anime.utils.remove(targets);
}
