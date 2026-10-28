import type { StoreSettings } from "@/lib/types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Applies the vendor's brand colours (admin → Branding) as CSS custom properties. */
export function BrandStyle({ settings }: { settings: StoreSettings }) {
  const c = settings.branding.colors;
  const vars: [string, string][] = [
    ["--bg", c.background],
    ["--panel", c.panel],
    ["--pink", c.primary],
    ["--gold", c.highlight],
    ["--blush", c.soft],
  ];
  const css = vars.filter(([, v]) => HEX.test(v)).map(([k, v]) => `${k}:${v};`).join("");
  const radius = Number.isFinite(settings.branding.radius) ? Math.max(0, Math.min(999, settings.branding.radius)) : 999;
  return <style>{`:root{${css}--radius-control:${radius}px;}`}</style>;
}
