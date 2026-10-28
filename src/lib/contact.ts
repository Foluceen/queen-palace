import type { StoreSettings } from "@/lib/types";

/** Contact helpers. Every link is derived from store settings; nothing is hard-coded. */

export function whatsappNumber(s: Pick<StoreSettings, "whatsapp">): string | null {
  const digits = (s.whatsapp ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function whatsappHref(s: Pick<StoreSettings, "whatsapp">, text?: string): string | null {
  const n = whatsappNumber(s);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telHref(phone: string | null): string | null {
  const p = (phone ?? "").replace(/[^\d+]/g, "");
  return p.length >= 7 ? `tel:${p}` : null;
}

export function mailHref(email: string | null): string | null {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : null;
}

/** A map search for the store address (no coordinates are invented). */
export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function hasAnyDirectContact(s: StoreSettings): boolean {
  return Boolean(whatsappNumber(s) || telHref(s.phone) || mailHref(s.contactEmail));
}
