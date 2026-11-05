/**
 * Maps known, equivalent backend formats onto the contract shape before validation.
 *
 * Only field renames and presentation defaults the frontend owns (tagline, palette, theme)
 * are applied. Business facts (name, address, contact details, hours) are copied as given
 * and never invented: a missing contact detail stays null and is hidden.
 */
import { DEFAULT_BRAND_COLORS, DEFAULT_CONTACT, DEFAULT_SOCIAL, DEFAULT_TAGLINE } from "@/lib/brand";
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
    contactEmail: str(raw.contactEmail) ?? str(raw.email) ?? DEFAULT_CONTACT.email,
    phone: str(raw.phone) ?? DEFAULT_CONTACT.phone,
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
    social: { instagram: str(social.instagram) ?? DEFAULT_SOCIAL.instagram, tiktok: str(social.tiktok) ?? DEFAULT_SOCIAL.tiktok, facebook: str(social.facebook) },
    announcement: announcement
      ? { enabled: announcement.enabled === true, message: str(announcement.message) ?? "", href: (safeHref(str(announcement.href)) as string | null) ?? null }
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

/**
 * Inventory rows: the production API returns one row per product
 * ({ productId, handle, title, sku, available }). Missing fields use the same defaults the
 * backend's own product view applies (tracked, policy "deny", low-stock threshold 5).
 */
function inventoryRow(raw: unknown): unknown {
  if (!isObj(raw) || "productTitle" in raw || typeof raw.productId !== "string") return raw;
  const available = typeof raw.available === "number" ? raw.available : 0;
  const threshold = typeof raw.lowStockThreshold === "number" ? raw.lowStockThreshold : 5;
  return {
    productId: raw.productId,
    productTitle: str(raw.title) ?? str(raw.handle) ?? "",
    variantId: str(raw.variantId) ?? raw.productId,
    variantTitle: str(raw.variantTitle) ?? "Default",
    sku: str(raw.sku) ?? "",
    available,
    tracked: raw.tracked !== false,
    policy: raw.policy === "continue" ? "continue" : "deny",
    lowStockThreshold: threshold,
    availability: available <= 0 ? "out_of_stock" : available < threshold ? "low_stock" : "in_stock",
  };
}
export const normalizeInventoryList = (raw: unknown) => (Array.isArray(raw) ? raw.map(inventoryRow) : raw);
export const normalizeInventoryRow = inventoryRow;

/**
 * Product lists: the production API returns full products ({ media, variants, options, … })
 * where the contract expects product cards. Everything a card needs is derived from the
 * product itself: first/second image, "Sold out" when nothing is available, "Sale" when a
 * compare-at price is above the price, and the first option's values as swatches.
 * Contract-shaped cards pass through unchanged.
 */
export function toProductCard(raw: unknown): unknown {
  if (!isObj(raw) || Array.isArray(raw.badges)) return raw;
  if (!Array.isArray(raw.media) && !Array.isArray(raw.variants)) return raw;
  const media = (Array.isArray(raw.media) ? raw.media : []).filter(isObj);
  const price = isObj(raw.priceRange) ? raw.priceRange : null;
  const compare = isObj(raw.compareAtPriceRange) ? raw.compareAtPriceRange : null;
  const options = (Array.isArray(raw.options) ? raw.options : []).filter(isObj);
  const first = options.find((o) => typeof o.name === "string" && Array.isArray(o.values) && o.values.length);
  const badges: string[] = [];
  if (raw.availability === "out_of_stock") badges.push("Sold out");
  else if (price && compare && typeof compare.max === "number" && typeof price.min === "number" && compare.max > price.min) badges.push("Sale");
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    subtitle: str(raw.subtitle) ?? "",
    image: media[0] ?? null,
    hoverImage: media[1] ?? null,
    priceRange: price ?? { min: 0, max: 0 },
    compareAtPriceRange: compare,
    availability: raw.availability,
    rating: isObj(raw.rating) ? raw.rating : { average: 0, count: 0 },
    swatches: first ? { option: String(first.name), values: (first.values as unknown[]).map(String) } : null,
    badges,
    ...(str(raw.createdAt) ? { createdAt: str(raw.createdAt) } : {}),
  };
}
const listingOf = (l: unknown) => (isObj(l) && Array.isArray(l.items) ? { ...l, items: l.items.map(toProductCard) } : l);
const cardsOf = (v: unknown) => (Array.isArray(v) ? v.map(toProductCard) : v);

/**
 * Links in API content (menus, homepage sections, the announcement) are rendered as hrefs.
 * Only same-site paths, http(s), mailto and tel are allowed; anything else (javascript:, data:,
 * vbscript:, protocol-relative "//host") becomes "/". Defence in depth against stored XSS.
 */
export function safeHref(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const h = v.trim();
  if (/^\/(?![\/\\])/.test(h) || h.startsWith("#") || h.startsWith("?")) return h;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
  return "/";
}
function sanitizeHrefs(v: unknown, depth = 0): unknown {
  if (depth > 6) return v;
  if (Array.isArray(v)) return v.map((x) => sanitizeHrefs(x, depth + 1));
  if (!isObj(v)) return v;
  const out: Obj = {};
  for (const [k, x] of Object.entries(v)) out[k] = /^(href|ctaHref|link|url)$/i.test(k) && typeof x === "string" && !/^(url)$/i.test(k) ? safeHref(x) : sanitizeHrefs(x, depth + 1);
  return out;
}

/* ------------------------------------------------------------ admin adapters */

/** { items: [...] } (paged) → plain list, for screens whose contract is a list. */
const itemsOf = (v: unknown) => (isObj(v) && Array.isArray(v.items) ? v.items : v);
/** { review: {...} } → review, { order: {...} } → order, etc. */
const unwrapKey = (key: string) => (v: unknown) => (isObj(v) && isObj(v[key]) ? v[key] : v);

/**
 * Admin order detail: the production API returns { order } with `items` instead of `lines`, and
 * no contact, address, delivery or timeline details. Lines are mapped from items; the missing
 * parts are left empty (the order page says they weren't recorded) and are never invented.
 */
export function normalizeAdminOrder(raw: unknown): unknown {
  const o = isObj(raw) && isObj(raw.order) ? raw.order : raw;
  if (!isObj(o) || Array.isArray(o.lines) || typeof o.number !== "string") return o;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const items = (Array.isArray(o.items) ? o.items : []).filter(isObj);
  const totals = isObj(o.totals) ? o.totals : {};
  return {
    ...o,
    accessToken: str(o.accessToken) ?? "",
    totals: { subtotal: num(totals.subtotal), discountTotal: num(totals.discountTotal), shippingTotal: num(totals.shippingTotal), taxTotal: num(totals.taxTotal), total: num(totals.total) },
    lines: items.map((l, i) => ({
      id: str(l.id) ?? `${String(l.productId ?? "line")}-${i}`,
      productId: String(l.productId ?? ""),
      variantId: String(l.variantId ?? l.productId ?? ""),
      title: str(l.title) ?? "",
      variantTitle: str(l.variantTitle) ?? "",
      sku: str(l.sku) ?? "",
      image: isObj(l.image) ? l.image : null,
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      lineTotal: num(l.lineTotal) || num(l.unitPrice) * num(l.quantity),
    })),
    contact: isObj(o.contact) ? o.contact : { email: str(o.email) ?? "", phone: str(o.phone) ?? "", marketingOptIn: false },
    shippingAddress: isObj(o.shippingAddress) ? o.shippingAddress : { firstName: "", lastName: "", phone: "", line1: "", city: "", state: "", country: "NG" },
    shippingRate: isObj(o.shippingRate) ? o.shippingRate : { id: "", label: "", etaDays: [0, 0] },
    discounts: Array.isArray(o.discounts) ? o.discounts : [],
    trackingNumber: str(o.trackingNumber),
    carrier: str(o.carrier),
    note: str(o.note),
    timeline: Array.isArray(o.timeline) ? o.timeline : [],
    bankTransfer: isObj(o.bankTransfer) ? o.bankTransfer : null,
  };
}

/**
 * Delivery quotes: the production API answers `{ rates: [{ id, label, amount, currency,
 * estimatedDays: "3-7 business days" }] }` without per-option totals. Unwrap the list and turn
 * the delivery time into a [min, max] range when it can be read; otherwise keep it as text.
 */
function normalizeShippingQuotes(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) ? (Array.isArray(v.rates) ? v.rates : Array.isArray(v.quotes) ? v.quotes : Array.isArray(v.items) ? v.items : null) : null;
  if (!list) return v;
  return list.map((q) => {
    if (!isObj(q)) return q;
    const eta = Array.isArray(q.etaDays) && q.etaDays.length === 2 ? q.etaDays : null;
    const text = str(q.estimatedDays) ?? str(q.eta) ?? "";
    const nums = text.match(/\d+/g)?.map(Number) ?? [];
    const parsed: [number, number] | null = /day/i.test(text) && nums.length ? [nums[0]!, nums[1] ?? nums[0]!] : null;
    return {
      ...q,
      id: q.id === undefined ? q.id : String(q.id),
      description: str(q.description) ?? (eta || parsed ? "" : text),
      etaDays: eta ?? parsed,
    };
  });
}

/** Dashboard low-stock rows arrive in snake_case from the production API. */
function normalizeDashboard(v: unknown): unknown {
  if (!isObj(v) || !Array.isArray(v.lowStock)) return v;
  return {
    ...v,
    lowStock: v.lowStock.filter(isObj).map((x) => ({
      variantId: String(x.variantId ?? x.variant_id ?? ""),
      productId: String(x.productId ?? x.product_id ?? ""),
      productTitle: str(x.productTitle) ?? str(x.product_title) ?? "",
      variantTitle: str(x.variantTitle) ?? str(x.variant_title) ?? "",
      sku: str(x.sku) ?? "",
      available: typeof x.available === "number" ? x.available : Number(x.available ?? 0),
    })),
  };
}


/* ------------------------------------------------------------- customer account */

/** Splits a full name the backend stores in one field. */
const splitName = (name: unknown): { firstName: string; lastName: string } => {
  const parts = (str(name) ?? "").split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

/** A customer in any of the backend's shapes ({ name } on login, { firstName, lastName } elsewhere). */
function toCustomer(c: unknown): unknown {
  if (!isObj(c)) return c;
  const split = splitName(c.name);
  return {
    ...c,
    id: String(c.id ?? ""),
    firstName: str(c.firstName) ?? str(c.first_name) ?? split.firstName,
    lastName: str(c.lastName) ?? str(c.last_name) ?? split.lastName,
    email: str(c.email) ?? "",
    phone: str(c.phone),
    createdAt: str(c.createdAt) ?? str(c.created_at) ?? "",
  };
}
const customerSession = (v: unknown) => (isObj(v) && isObj(v.customer) ? { ...v, customer: toCustomer(v.customer) } : v);
const customerAccount = (v: unknown) => toCustomer(isObj(v) && isObj(v.customer) ? v.customer : v);

/** The backend keeps the landmark inside line2 ("… · Landmark: …"); see addressRequest. */
const LANDMARK = "Landmark: ";
/** Saved addresses arrive as database rows: { items: [{ recipient, line1, line2, is_default, … }] }. */
function toSavedAddress(a: unknown): unknown {
  if (!isObj(a) || typeof a.firstName === "string") return a;
  const name = splitName(a.recipient);
  const rawLine2 = str(a.line2) ?? "";
  const at = rawLine2.indexOf(LANDMARK);
  const line2 = (at >= 0 ? rawLine2.slice(0, at) : rawLine2).replace(/\s*·\s*$/, "");
  return {
    id: String(a.id ?? ""),
    label: str(a.label) ?? "Address",
    isDefault: a.isDefault === true || a.is_default === true,
    ...name,
    phone: str(a.phone) ?? "",
    line1: str(a.line1) ?? "",
    line2,
    landmark: at >= 0 ? rawLine2.slice(at + LANDMARK.length) : "",
    city: str(a.city) ?? "",
    state: str(a.state) ?? "",
    country: "NG",
  };
}
function savedAddresses(v: unknown): unknown {
  const list = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.items) ? v.items : isObj(v) && isObj(v.address) ? null : v;
  return Array.isArray(list) ? list.map(toSavedAddress) : v;
}
/** Wishlist: GET answers { items: [products] }, PUT answers { items: [ids] }. */
function wishlist(v: unknown): unknown {
  if (!isObj(v) || Array.isArray(v.productIds) || !Array.isArray(v.items)) return v;
  return { productIds: v.items.map((x) => (isObj(x) ? String(x.id ?? "") : String(x))).filter(Boolean) };
}

/**
 * Request bodies the live backend expects in its own shape. Mock mode keeps the frontend shape.
 * Saved address: { label, recipient, line1, line2, city, state, country, phone, isDefault }.
 */
export function normalizeRequest(name: EndpointName, body: unknown, live: boolean): unknown {
  if (!live || !isObj(body)) return body;
  if (name === "saveAddress") {
    const b = body as Record<string, unknown>;
    const line2 = [str(b.line2), str(b.landmark) ? `${LANDMARK}${str(b.landmark)}` : null].filter(Boolean).join(" · ");
    return {
      ...(str(b.id) ? { id: str(b.id) } : {}),
      label: str(b.label) ?? "Home",
      recipient: [str(b.firstName), str(b.lastName)].filter(Boolean).join(" "),
      line1: str(b.line1) ?? "",
      ...(line2 ? { line2 } : {}),
      city: str(b.city) ?? "",
      state: str(b.state) ?? "",
      country: "NG",
      phone: str(b.phone) ?? "",
      isDefault: b.isDefault === true,
    };
  }
  return body;
}

/** Staff invite: the live API answers { staff: { …, role }, invitation: { token, expiresAt } }. */
function staffInvite(v: unknown): unknown {
  if (!isObj(v) || !isObj(v.staff)) return v;
  const s = v.staff;
  return { ...s, roleId: str(s.roleId) ?? str(s.role) ?? "", lastActiveAt: s.lastActiveAt ?? null, invitation: isObj(v.invitation) ? v.invitation : undefined };
}

const normalizers: Partial<Record<EndpointName, (data: unknown) => unknown>> = {
  adminInviteStaff: staffInvite,
  getShippingRates: normalizeShippingQuotes,
  // Store order replies come as { order: { …, items } } like the admin ones: same mapping.
  getOrder: normalizeAdminOrder,
  verifyPayment: normalizeAdminOrder,
  trackOrder: normalizeAdminOrder,
  listCustomerOrders: itemsOf,
  customerLogin: customerSession,
  customerRegister: customerSession,
  getCustomer: customerSession,
  getCustomerAccount: customerAccount,
  listAddresses: savedAddresses,
  saveAddress: savedAddresses,
  deleteAddress: savedAddresses,
  getWishlist: wishlist,
  replaceWishlist: wishlist,
  adminListReviews: itemsOf,
  adminModerateReview: unwrapKey("review"),
  adminGetOrder: normalizeAdminOrder,
  adminUpdateFulfillment: normalizeAdminOrder,
  adminMarkTransferReceived: normalizeAdminOrder,
  adminCancelOrder: normalizeAdminOrder,
  adminRefundOrder: normalizeAdminOrder,
  adminAddOrderNote: normalizeAdminOrder,
  adminDashboard: normalizeDashboard,
  getNavigation: (v) => sanitizeHrefs(v),
  listProducts: listingOf,
  getCollection: (v) => (isObj(v) && isObj(v.listing) ? { ...v, listing: listingOf(v.listing) } : v),
  search: (v) => (isObj(v) && isObj(v.products) ? { ...v, products: listingOf(v.products) } : v),
  getProduct: (v) => (isObj(v) && Array.isArray(v.related) ? { ...v, related: cardsOf(v.related) } : v),
  getHomepage: (raw) => {
    const v = sanitizeHrefs(raw);
    return isObj(v) && Array.isArray(v.sections)
      ? { ...v, sections: v.sections.map((sec) => (isObj(sec) && Array.isArray(sec.products) ? { ...sec, products: cardsOf(sec.products) } : sec)) }
      : v;
  },
  adminListInventory: normalizeInventoryList,
  adminAdjustInventory: normalizeInventoryRow,
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
