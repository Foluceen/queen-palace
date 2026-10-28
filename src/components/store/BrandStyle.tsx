import type { BrandColors, StoreSettings } from "@/lib/types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Built-in palette. Only colours the owner changes in admin → Branding are emitted. */
const DEFAULTS: BrandColors = {
  gold: "#c9a45c",
  burgundy: "#6b1630",
  lightBackground: "#faf6ef",
  lightSurface: "#f4ecdf",
  darkBackground: "#0e0b0c",
  darkSurface: "#191516",
};

const changed = (c: BrandColors, k: keyof BrandColors) => HEX.test(c[k]) && c[k].toLowerCase() !== DEFAULTS[k];

/**
 * Applies brand colours from store settings as CSS custom properties for both themes.
 * Dark-mode gold and burgundy are lifted slightly so they keep contrast on near-black.
 */
export function BrandStyle({ settings }: { settings: StoreSettings }) {
  const c = settings.branding.colors;
  const light: string[] = [];
  const dark: string[] = [];
  if (changed(c, "gold")) {
    light.push(`--gold:${c.gold}`);
    dark.push(`--gold:color-mix(in srgb,${c.gold} 86%,white)`, `--gold-ink:color-mix(in srgb,${c.gold} 74%,white)`);
  }
  if (changed(c, "burgundy")) {
    light.push(`--burgundy:${c.burgundy}`);
    dark.push(`--burgundy:color-mix(in srgb,${c.burgundy} 82%,white)`, `--burgundy-ink:color-mix(in srgb,${c.burgundy} 40%,white)`);
  }
  if (changed(c, "lightBackground")) light.push(`--bg:${c.lightBackground}`);
  if (changed(c, "lightSurface")) light.push(`--surface:${c.lightSurface}`, `--surface-2:color-mix(in srgb,${c.lightSurface} 90%,black)`);
  if (changed(c, "darkBackground")) dark.push(`--bg:${c.darkBackground}`);
  if (changed(c, "darkSurface")) dark.push(`--surface:${c.darkSurface}`, `--surface-2:color-mix(in srgb,${c.darkSurface} 88%,white)`);
  const r = settings.branding.radius;
  if (Number.isFinite(r) && r !== 6) light.push(`--radius-control:${Math.max(0, Math.min(999, r))}px`);
  if (!light.length && !dark.length) return null;
  const d = dark.join(";");
  const css =
    (light.length ? `:root{${light.join(";")}}` : "") +
    (d ? `:root[data-theme="dark"]{${d}}@media (prefers-color-scheme:dark){:root:not([data-theme]){${d}}}` : "");
  return <style>{css}</style>;
}
