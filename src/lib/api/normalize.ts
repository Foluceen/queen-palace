/**
 * Maps known, equivalent backend formats onto the contract shape before validation.
 *
 * Only field renames and presentation defaults the frontend owns (tagline, palette, theme)
 * are applied. Business facts (name, address, contact details, hours) are copied as given
 * and never invented: a missing contact detail stays null and is hidden.
 */
import { DEFAULT_BRAND_COLORS, DEFAULT_TAGLINE } from "@/lib/brand";
import { PERMISSIONS, type AdminSession, type Permission, type StoreSettings } from "@/lib/types";
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

/**
 * Maps the backend's permission names onto the frontend's names, without widening them:
 * - separators and case: "dashboard.read", "DASHBOARD_READ", "read:dashboard" → "dashboard:read"
 * - an explicit full grant: "*", "all", "*:*", "admin:*" → every permission
 * - an explicit resource grant: "products:*" or "products:manage" → every "products:" permission
 * Anything else that doesn't match a known permission is ignored (and shown on the access screen).
 */
export function canonicalPermissions(names: string[]): Permission[] {
  const known = new Set<string>(PERMISSIONS);
  const out = new Set<Permission>();
  for (const raw of names) {
    const n = raw.trim().toLowerCase().replace(/[._\-/ ]+/g, ":");
    if (n === "*" || n === "all" || n === "*:*" || n === "admin:*" || n === "admin:all") {
      PERMISSIONS.forEach((p) => out.add(p));
      continue;
    }
    const [a = "", b = ""] = n.split(":");
    if (known.has(n)) out.add(n as Permission);
    else if (known.has(`${b}:${a}`)) out.add(`${b}:${a}` as Permission);
    else if (b === "*" || b === "manage" || b === "all") PERMISSIONS.filter((p) => p.startsWith(`${a}:`)).forEach((p) => out.add(p));
  }
  return PERMISSIONS.filter((p) => out.has(p));
}

/**
 * Admin session: accepts the contract shape, or a staff/user/admin object with the role as a
 * string or object, optionally wrapped in { session } or { data }. Permissions are taken from
 * the response. Only when the response gives none and the role is the store owner does the
 * UI show every section; the backend still authorises every request.
 */
export function normalizeAdminSession(raw: unknown): unknown {
  let r: unknown = raw;
  if (isObj(r) && !("staff" in r) && isObj(r.session)) r = r.session;
  if (isObj(r) && !("staff" in r) && isObj(r.data)) r = r.data;
  if (!isObj(r)) return raw;
  const person = isObj(r.staff) ? r.staff : isObj(r.user) ? r.user : isObj(r.admin) ? r.admin : null;
  if (!person) return raw;
  const roleRaw = r.role ?? person.role;
  const roleObj = isObj(roleRaw) ? roleRaw : null;
  const roleName = str(roleObj?.name) ?? str(roleRaw) ?? "Staff";
  // Every list the backend sends counts (top level, role, user); names are canonicalised but
  // never invented. An explicitly empty list stays empty.
  const lists = [r.permissions, roleObj?.permissions, person.permissions].filter(Array.isArray) as unknown[][];
  const received = [...new Set(lists.flat().filter((p): p is string => typeof p === "string"))];
  let permissions: Permission[] | undefined = lists.length ? canonicalPermissions(received) : undefined;
  if (!lists.length && /^(owner|super ?admin)$/i.test(roleName)) permissions = [...PERMISSIONS];
  if (!permissions) return raw; // no permission information: let validation report it
  const name =
    str(person.name) ??
    str(person.fullName) ??
    ([str(person.firstName), str(person.lastName)].filter(Boolean).join(" ") || null) ??
    str(person.email) ??
    "Staff";
  const session: AdminSession = {
    staff: {
      id: String(person.id ?? ""),
      name,
      email: str(person.email) ?? "",
      roleId: String(roleObj?.id ?? person.roleId ?? roleName.toLowerCase()),
      status: person.status === "invited" || person.status === "suspended" ? person.status : "active",
      lastActiveAt: str(person.lastActiveAt),
    },
    role: {
      id: String(roleObj?.id ?? person.roleId ?? roleName.toLowerCase()),
      name: roleName,
      description: str(roleObj?.description) ?? "",
      permissions,
      system: roleObj?.system === true || /^owner$/i.test(roleName),
    },
    permissions,
    expiresAt: str(r.expiresAt) ?? str(r.expires_at) ?? "",
    receivedPermissions: received,
  };
  return session;
}

/**
 * Cart: the production API returns totals at the top level ({ subtotal, discountTotal,
 * shippingTotal, total }) without itemCount, discounts or notices. Amounts are copied as given;
 * itemCount is the sum of line quantities. Contract-shaped carts pass through unchanged.
 */
export function normalizeCart(raw: unknown): unknown {
  if (!isObj(raw) || typeof raw.id !== "string" || !Array.isArray(raw.lines) || isObj(raw.totals)) return raw;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const lines = raw.lines as unknown[];
  return {
    ...raw,
    currency: str(raw.currency) ?? "NGN",
    itemCount: typeof raw.itemCount === "number" ? raw.itemCount : lines.reduce<number>((n, l) => n + (isObj(l) ? num(l.quantity) : 0), 0),
    discounts: Array.isArray(raw.discounts) ? raw.discounts : [],
    notices: Array.isArray(raw.notices) ? raw.notices : [],
    updatedAt: str(raw.updatedAt) ?? "",
    totals: {
      subtotal: num(raw.subtotal),
      discountTotal: num(raw.discountTotal),
      shippingTotal: typeof raw.shippingTotal === "number" ? raw.shippingTotal : null,
      taxTotal: num(raw.taxTotal),
      total: num(raw.total),
    },
  };
}

const normalizers: Partial<Record<EndpointName, (data: unknown) => unknown>> = {
  createCart: normalizeCart,
  getCart: normalizeCart,
  addCartLines: normalizeCart,
  updateCartLine: normalizeCart,
  removeCartLine: normalizeCart,
  applyDiscount: normalizeCart,
  removeDiscount: normalizeCart,
  getStoreSettings: normalizeSettings,
  adminSession: normalizeAdminSession,
  adminLogin: normalizeAdminSession,
};

export function normalizeResponse(name: EndpointName, data: unknown): unknown {
  const fn = normalizers[name];
  return fn ? fn(data) : data;
}
