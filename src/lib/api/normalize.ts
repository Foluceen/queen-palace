/**
 * Maps known, equivalent backend formats onto the contract shape before validation.
 *
 * Only field renames and presentation defaults the frontend owns (tagline, palette, theme)
 * are applied. Business facts (name, address, contact details, hours) are copied as given
 * and never invented: a missing contact detail stays null and is hidden.
 */
import { DEFAULT_BRAND_COLORS, DEFAULT_TAGLINE } from "@/lib/brand";
import type { StoreSettings } from "@/lib/types";
import type { EndpointName } from "./contract";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function hoursText(v: unknown): string | null {
  if (typeof v === "string") return str(v);
  if (!Array.isArray(v)) return null;
  const parts = v
    .map((h) => {
      if (typeof h === "string") return h.trim();
      if (isObj(h)) {
        const label = str(h.label) ?? str(h.day) ?? str(h.days);
        const time = str(h.hours) ?? (str(h.open) && str(h.close) ? `${str(h.open)} to ${str(h.close)}` : null);
        return [label, time].filter(Boolean).join(" ");
      }
      return "";
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function normalizeSettings(raw: unknown): unknown {
  if (!isObj(raw) || typeof raw.name !== "string") return raw;
  const social = isObj(raw.social) ? raw.social : isObj(raw.socials) ? raw.socials : {};
  const branding = isObj(raw.branding) ? raw.branding : {};
  const colors = isObj(branding.colors) ? branding.colors : {};
  const theme = isObj(raw.theme) ? raw.theme : {};
  const notes = isObj(raw.productPageNotes) ? raw.productPageNotes : {};
  const announcement = isObj(raw.announcement) ? raw.announcement : null;
  const address = str(raw.address) ?? "";
  const name = raw.name.trim() || "Queen Luxury Hair";
  const settings: StoreSettings = {
    name,
    tagline: str(raw.tagline) ?? DEFAULT_TAGLINE,
    metaDescription:
      str(raw.metaDescription) ??
      `${name}: wigs, frontals, closures, bundles and hair care.${address ? ` Shop online or visit us at ${address}.` : ""}`,
    logo: (raw.logo as StoreSettings["logo"]) ?? null,
    logoDark: (raw.logoDark as StoreSettings["logoDark"]) ?? null,
    contactEmail: str(raw.contactEmail) ?? str(raw.email),
    phone: str(raw.phone),
    whatsapp: str(raw.whatsapp),
    address,
    openingHours: hoursText(raw.openingHours ?? raw.hours),
    currency: (str(raw.currency) ?? "NGN") as StoreSettings["currency"],
    branding: {
      colors: { ...DEFAULT_BRAND_COLORS, ...(colors as Partial<StoreSettings["branding"]["colors"]>) },
      radius: typeof branding.radius === "number" ? branding.radius : 999,
    },
    theme: { defaultMode: theme.defaultMode === "light" || theme.defaultMode === "system" ? theme.defaultMode : "dark" },
    productPageNotes: { shipping: str(notes.shipping) ?? "", returns: str(notes.returns) ?? "" },
    social: { instagram: str(social.instagram), tiktok: str(social.tiktok), facebook: str(social.facebook) },
    announcement: announcement
      ? { enabled: announcement.enabled === true, message: str(announcement.message) ?? "", href: str(announcement.href) }
      : { enabled: false, message: "", href: null },
    freeShippingThreshold: typeof raw.freeShippingThreshold === "number" ? raw.freeShippingThreshold : null,
  };
  return settings;
}

const normalizers: Partial<Record<EndpointName, (data: unknown) => unknown>> = {
  getStoreSettings: normalizeSettings,
};

export function normalizeResponse(name: EndpointName, data: unknown): unknown {
  const fn = normalizers[name];
  return fn ? fn(data) : data;
}
