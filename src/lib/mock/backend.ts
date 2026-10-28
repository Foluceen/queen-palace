/**
 * Mock backend: implements every endpoint in the contract against the in-memory db.
 * It behaves like the real backend on the things that matter for UI honesty:
 * prices, stock, shipping and discounts are computed here, never in components, and
 * no order placed through mock checkout is ever marked as paid.
 */
import { isNigerianPhone, PHONE_ERROR } from "@/lib/phone";
import { decodeOptions, type Contract, type EndpointName, type RequestOf, type ResponseOf } from "@/lib/api/contract";
import type {
  Availability,
  Cart,
  CartDiscount,
  AnalyticsReport,
  Collection,
  CustomerSummary,
  DashboardSummary,
  Discount,
  Facet,
  Homepage,
  InventoryRow,
  Media,
  Order,
  OrderSummary,
  Paginated,
  Permission,
  Product,
  ProductCard,
  ProductListing,
  ProductQuery,
  ProductSort,
  ResolvedAttribute,
  Review,
  SavedAddress,
  ShippingRate,
  Variant,
} from "@/lib/types";
import { getDb, newId, type MockCart, type MockCustomerAccount, type MockDb } from "./db";

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface MockContext {
  getCookie(name: string): string | undefined;
  setCookie(name: string, value: string, maxAgeSeconds: number): void;
  clearCookie(name: string): void;
}

const ADMIN_COOKIE = "qp_mock_admin";
const CUSTOMER_COOKIE = "qp_mock_customer";
const EMAIL = /^\S+@\S+\.\S+$/;

const fail = (status: number, code: string, message: string, fields?: Record<string, string>): never => {
  throw new MockHttpError(status, code, message, fields);
};
const now = () => new Date().toISOString();
const num = (v: unknown, d: number) => {
  const x = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : d;
};
const bool = (v: unknown) => v === true || v === "true" || v === "1";

/* ------------------------------------------------------------- derivations */

export function variantAvailability(v: Variant): Availability {
  if (!v.inventory.tracked) return "in_stock";
  if (v.inventory.available <= 0) return v.inventory.policy === "continue" ? "preorder" : "out_of_stock";
  if (v.inventory.available <= v.inventory.lowStockThreshold) return "low_stock";
  return "in_stock";
}

function refreshProduct(p: Product): Product {
  for (const v of p.variants) v.availability = variantAvailability(v);
  const prices = p.variants.map((v) => v.price);
  const compares = p.variants.map((v) => v.compareAtPrice).filter((x): x is number => x !== null);
  p.priceRange = { min: Math.min(...prices, Infinity) === Infinity ? 0 : Math.min(...prices), max: prices.length ? Math.max(...prices) : 0 };
  p.compareAtPriceRange = compares.length ? { min: Math.min(...compares), max: Math.max(...compares) } : null;
  const avs = p.variants.map((v) => v.availability);
  p.availability = avs.includes("in_stock") ? "in_stock" : avs.includes("low_stock") ? "low_stock" : avs.includes("preorder") ? "preorder" : "out_of_stock";
  return p;
}

function refreshAll(db: MockDb) {
  db.products.forEach(refreshProduct);
  // Ratings come only from published reviews, so the stars always match what shoppers can read.
  const stats = new Map<string, { sum: number; count: number }>();
  for (const r of db.reviews) {
    if (r.status !== "published") continue;
    const s = stats.get(r.productId) ?? { sum: 0, count: 0 };
    s.sum += r.rating;
    s.count += 1;
    stats.set(r.productId, s);
  }
  for (const p of db.products) {
    const s = stats.get(p.id);
    p.rating = s ? { average: Math.round((s.sum / s.count) * 10) / 10, count: s.count } : { average: 0, count: 0 };
  }
  for (const c of db.collections) {
    c.productCount = db.products.filter((p) => p.status === "published" && p.collectionIds.includes(c.id)).length;
  }
  for (const t of db.productTypes) t.productCount = db.products.filter((p) => p.productTypeId === t.id).length;
}

function resolveAttributes(db: MockDb, p: Product): ResolvedAttribute[] {
  const type = db.productTypes.find((t) => t.id === p.productTypeId);
  if (!type) return [];
  return type.attributes
    .map((a) => ({ key: a.key, label: a.label, kind: a.kind, group: a.group, value: (p.attributes[a.key] ?? "").trim() }))
    .filter((a) => a.value !== "");
}

/** Units sold per product from paid orders (used for "Best sellers"). */
function unitsSold(db: MockDb) {
  const units = new Map<string, number>();
  for (const o of db.orders) {
    if (!["paid", "partially_refunded"].includes(o.paymentStatus)) continue;
    for (const l of o.lines) units.set(l.productId, (units.get(l.productId) ?? 0) + l.quantity);
  }
  return units;
}

function toCard(p: Product): ProductCard {
  const swatchOption = p.options.find((o) => o.name === "Length") ?? p.options.find((o) => o.name === "Colour") ?? p.options[0];
  // Only show a "was" price when it applies to the cheapest option the card advertises.
  const cheapest = p.variants.filter((v) => v.price === p.priceRange.min);
  const cheapestCompare = cheapest.map((v) => v.compareAtPrice).filter((x): x is number => x !== null && x > p.priceRange.min);
  const compareAtPriceRange = cheapestCompare.length ? { min: Math.min(...cheapestCompare), max: Math.max(...cheapestCompare) } : null;
  const badges: string[] = [];
  if (compareAtPriceRange) badges.push("Sale");
  if (Date.now() - Date.parse(p.createdAt) < 1000 * 60 * 60 * 24 * 10) badges.push("New");
  if (p.availability === "out_of_stock") badges.push("Sold out");
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    subtitle: p.subtitle,
    image: p.media[0] ?? null,
    hoverImage: p.media[1] ?? null,
    priceRange: p.priceRange,
    compareAtPriceRange,
    availability: p.availability,
    rating: p.rating,
    swatches: swatchOption && swatchOption.values.length > 1 ? { option: swatchOption.name, values: swatchOption.values } : null,
    badges,
  };
}

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total, totalPages };
}

function matchesQuery(p: Product, q: string) {
  const hay = [p.title, p.subtitle, p.description, ...p.tags, ...p.options.flatMap((o) => o.values)].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

function buildListing(db: MockDb, base: Product[], query: ProductQuery): ProductListing {
  const sort: ProductSort = query.sort ?? "featured";
  const options = query.options ?? {};
  let items = base;
  if (query.q) items = items.filter((p) => matchesQuery(p, query.q!));

  const facetSource = items;
  for (const [name, values] of Object.entries(options)) {
    items = items.filter((p) => p.variants.some((v) => v.options[name] !== undefined && values.includes(v.options[name]!) && (!query.inStock || v.availability !== "out_of_stock")));
  }
  if (query.inStock) items = items.filter((p) => p.availability !== "out_of_stock");
  if (query.minPrice !== undefined) items = items.filter((p) => p.priceRange.max >= query.minPrice!);
  if (query.maxPrice !== undefined) items = items.filter((p) => p.priceRange.min <= query.maxPrice!);

  const units = sort === "best_selling" ? unitsSold(db) : new Map<string, number>();
  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case "newest":
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      case "price_asc":
        return a.priceRange.min - b.priceRange.min;
      case "price_desc":
        return b.priceRange.min - a.priceRange.min;
      case "rating":
        return b.rating.average - a.rating.average || b.rating.count - a.rating.count;
      case "best_selling":
        return (units.get(b.id) ?? 0) - (units.get(a.id) ?? 0) || Number(b.featured) - Number(a.featured);
      default:
        return Number(b.featured) - Number(a.featured) || b.rating.count - a.rating.count;
    }
  });

  // Facets come from whatever options the products in view actually have (data-driven, not wig-specific).
  const facetNames = [...new Set(facetSource.flatMap((p) => p.options.map((o) => o.name)))];
  const facets: Facet[] = facetNames
    .map((name) => {
      const counts = new Map<string, number>();
      for (const p of facetSource) {
        const vals = new Set(p.variants.map((v) => v.options[name]).filter((x): x is string => !!x));
        vals.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      }
      const values = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => (parseFloat(a.value) || 0) - (parseFloat(b.value) || 0) || a.value.localeCompare(b.value));
      return { name, values };
    })
    .filter((f) => f.values.length > 1);

  const allPrices = facetSource.flatMap((p) => [p.priceRange.min, p.priceRange.max]);
  const page = paginate(sorted.map(toCard), num(query.page, 1), Math.min(48, num(query.pageSize, 12)));
  return { ...page, facets, priceBounds: { min: allPrices.length ? Math.min(...allPrices) : 0, max: allPrices.length ? Math.max(...allPrices) : 0 } };
}

const published = (db: MockDb) => db.products.filter((p) => p.status === "published");
const findVariant = (db: MockDb, variantId: string) => {
  for (const p of db.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return null;
};

/* --------------------------------------------------------------------- cart */

function discountApplies(db: MockDb, d: Discount, productId: string) {
  if (d.appliesTo.type === "all") return true;
  if (d.appliesTo.type === "products") return d.appliesTo.ids.includes(productId);
  const p = db.products.find((x) => x.id === productId);
  return !!p && p.collectionIds.some((c) => (d.appliesTo as { ids: string[] }).ids.includes(c));
}

function discountStatus(d: Discount): Discount["status"] {
  if (d.status === "disabled") return "disabled";
  const t = Date.now();
  if (Date.parse(d.startsAt) > t) return "scheduled";
  if (d.endsAt && Date.parse(d.endsAt) < t) return "expired";
  if (d.usageLimit !== null && d.usageCount >= d.usageLimit) return "expired";
  return "active";
}

function computeCart(db: MockDb, cart: MockCart, shippingAmount: number | null = null): Cart {
  const notices = [...cart.notices];
  cart.notices = [];
  const lines = cart.lines
    .map((line) => {
      const found = findVariant(db, line.variantId);
      if (!found || found.product.status !== "published") {
        notices.push("An item in your bag is no longer available and was removed.");
        return null;
      }
      const { product, variant } = found;
      const max = variant.inventory.tracked && variant.inventory.policy === "deny" ? variant.inventory.available : 20;
      if (max <= 0) {
        notices.push(`${product.title} (${variant.title}) just sold out and was removed.`);
        return null;
      }
      if (line.quantity > max) {
        notices.push(`Only ${max} of ${product.title} (${variant.title}) left, so we updated your quantity.`);
        line.quantity = max;
      }
      const image = product.media.find((m) => m.id === variant.mediaId) ?? product.media[0] ?? null;
      return {
        id: line.id,
        productId: product.id,
        variantId: variant.id,
        handle: product.handle,
        productTitle: product.title,
        variantTitle: variant.title,
        image,
        quantity: line.quantity,
        unitPrice: variant.price,
        compareAtPrice: variant.compareAtPrice,
        lineTotal: variant.price * line.quantity,
        maxQuantity: Math.min(max, 20),
        availability: variant.availability,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  cart.lines = cart.lines.filter((l) => lines.some((x) => x.id === l.id));

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discounts: CartDiscount[] = [];
  let freeShipping = false;
  for (const code of cart.codes) {
    const d = db.discounts.find((x) => x.code === code);
    if (!d || discountStatus(d) !== "active") continue;
    if (d.minSubtotal && subtotal < d.minSubtotal) {
      notices.push(`${d.code} needs a subtotal of at least ₦${(d.minSubtotal / 100).toLocaleString("en-NG")}.`);
      continue;
    }
    const eligible = lines.filter((l) => discountApplies(db, d, l.productId)).reduce((s, l) => s + l.lineTotal, 0);
    if (d.kind === "free_shipping") {
      freeShipping = true;
      discounts.push({ code: d.code, label: d.title, amount: 0 });
    } else {
      const amount = d.kind === "percentage" ? Math.round((eligible * d.value) / 100) : Math.min(d.value, eligible);
      if (amount > 0) discounts.push({ code: d.code, label: d.title, amount });
    }
  }
  const discountTotal = Math.min(subtotal, discounts.reduce((s, d) => s + d.amount, 0));
  const shippingTotal = shippingAmount === null ? null : freeShipping ? 0 : shippingAmount;
  return {
    id: cart.id,
    currency: "NGN",
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    discounts,
    totals: { subtotal, discountTotal, shippingTotal, taxTotal: 0, total: subtotal - discountTotal + (shippingTotal ?? 0) },
    notices: [...new Set(notices)],
    updatedAt: cart.updatedAt,
  };
}

function getCartOr404(db: MockDb, id: string) {
  return db.carts.get(id) ?? fail(404, "cart_not_found", "This bag has expired. We started a new one for you.");
}

function addLines(db: MockDb, cart: MockCart, lines: { variantId: string; quantity: number }[]) {
  for (const input of lines) {
    const found = findVariant(db, input.variantId);
    if (!found || found.product.status !== "published") fail(404, "variant_not_found", "That option is no longer available.");
    const { variant, product } = found!;
    const qty = Math.max(1, Math.floor(input.quantity));
    const existing = cart.lines.find((l) => l.variantId === variant.id);
    const desired = (existing?.quantity ?? 0) + qty;
    if (variant.availability === "out_of_stock") fail(409, "out_of_stock", `${product.title} (${variant.title}) is sold out.`);
    if (variant.inventory.tracked && variant.inventory.policy === "deny" && desired > variant.inventory.available) {
      fail(409, "insufficient_stock", `Only ${variant.inventory.available} of ${product.title} (${variant.title}) available.`);
    }
    if (existing) existing.quantity = desired;
    else cart.lines.push({ id: newId("line"), variantId: variant.id, quantity: qty });
  }
  cart.updatedAt = now();
}

/* ----------------------------------------------------------------- shipping */

function ratesFor(db: MockDb, state: string, subtotal: number, city = ""): ShippingRate[] {
  const town = city.trim().toLowerCase();
  const cityMatch = (cities: string[]) => cities.length === 0 || (town !== "" && cities.some((c) => town.includes(c.toLowerCase())));
  // Most specific first: zones that list towns, then whole-state zones, then the catch-all.
  const zone =
    db.shipping.zones.find((z) => z.states.includes(state) && z.cities.length > 0 && cityMatch(z.cities)) ??
    db.shipping.zones.find((z) => z.states.includes(state) && z.cities.length === 0) ??
    db.shipping.zones.find((z) => z.states.length === 0);
  if (!zone) return [];
  return zone.rates.map(({ freeOver, ...r }) => ({ ...r, amount: freeOver !== null && subtotal >= freeOver ? 0 : r.amount }));
}

/* ------------------------------------------------------------------- orders */

const summary = (o: Order): OrderSummary => ({
  id: o.id,
  number: o.number,
  accessToken: o.accessToken,
  status: o.status,
  paymentStatus: o.paymentStatus,
  fulfillmentStatus: o.fulfillmentStatus,
  paymentMethod: o.paymentMethod,
  email: o.email,
  totals: o.totals,
  itemCount: o.itemCount,
  createdAt: o.createdAt,
});

const publicOrder = (o: Order): Order => ({ ...o, timeline: o.timeline.filter((e) => !e.internal) });

function event(o: Order, type: Order["timeline"][number]["type"], message: string, internal = false) {
  o.timeline.push({ id: newId("ev"), type, message, createdAt: now(), internal });
}

/* --------------------------------------------------------------------- auth */

function adminSession(db: MockDb, ctx: MockContext) {
  const token = ctx.getCookie(ADMIN_COOKIE);
  const s = token ? db.adminSessions.get(token) : undefined;
  if (!s || s.expiresAt < Date.now()) fail(401, "unauthenticated", "Your session has ended. Sign in again.");
  const staff = db.staff.find((x) => x.id === s!.staffId && x.status === "active") ?? fail(401, "unauthenticated", "Your account is not active.");
  const role = db.roles.find((r) => r.id === staff.roleId) ?? fail(403, "forbidden", "Your role no longer exists.");
  return { staff, role, permissions: role.permissions, expiresAt: new Date(s!.expiresAt).toISOString() };
}

function requirePerm(db: MockDb, ctx: MockContext, perm: Permission) {
  const s = adminSession(db, ctx);
  if (!s.permissions.includes(perm)) fail(403, "forbidden", "Your role doesn't allow this action.");
  return s;
}

function requireAccount(db: MockDb, ctx: MockContext): MockCustomerAccount {
  const token = ctx.getCookie(CUSTOMER_COOKIE);
  const id = token ? db.customerSessions.get(token) : undefined;
  const account = id ? db.accounts.find((a) => a.customer.id === id) : undefined;
  if (!account) fail(401, "unauthenticated", "Sign in to see your account.");
  return account!;
}
const requireCustomer = (db: MockDb, ctx: MockContext) => requireAccount(db, ctx).customer;

function startCustomerSession(db: MockDb, ctx: MockContext, account: MockCustomerAccount) {
  const token = newId("cs");
  db.customerSessions.set(token, account.customer.id);
  ctx.setCookie(CUSTOMER_COOKIE, token, 60 * 60 * 24 * 14);
  return { customer: account.customer };
}

function validateAddress(a: Partial<SavedAddress>): Record<string, string> {
  const f: Record<string, string> = {};
  if (!a.firstName?.trim()) f.firstName = "Enter a first name.";
  if (!a.lastName?.trim()) f.lastName = "Enter a last name.";
  if (!isNigerianPhone(a.phone ?? "")) f.phone = PHONE_ERROR;
  if (!a.line1?.trim()) f.line1 = "Enter a street address.";
  if (!a.city?.trim()) f.city = "Enter a city or town.";
  if (!a.state) f.state = "Choose a state.";
  return f;
}

/* ----------------------------------------------------------------- handlers */

type Handler<K extends EndpointName> = (req: RequestOf<K>, ctx: MockContext, db: MockDb) => ResponseOf<K>;
type Handlers = { [K in EndpointName]: Handler<K> };

const mediaFor = (db: MockDb, ids: string[]) => ids.map((id) => db.media.find((m) => m.id === id)).filter((m): m is Media => !!m);
const sortedCollections = (db: MockDb) => [...db.collections].sort((a, b) => a.position - b.position);

function homepage(db: MockDb, includeDisabled: boolean): Homepage {
  const sections = [...db.homepage]
    .filter((s) => includeDisabled || (s.enabled && !(s.type === "promo" && s.endsAt && Date.parse(s.endsAt) < Date.now())))
    .sort((a, b) => a.position - b.position);
  const pub = published(db);
  const resolved = sections.map((s) => {
    if (s.type === "product_rail") {
      let list = pub;
      if (s.source.kind === "featured") list = pub.filter((p) => p.featured);
      if (s.source.kind === "best_sellers") {
        const units = unitsSold(db);
        list = [...pub].sort((a, b) => (units.get(b.id) ?? 0) - (units.get(a.id) ?? 0) || b.rating.count - a.rating.count);
      }
      if (s.source.kind === "newest") list = [...pub].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      let href = s.source.kind === "newest" ? "/search?sort=newest" : s.source.kind === "best_sellers" ? "/search?sort=best_selling" : "/search";
      if (s.source.kind === "collection") {
        const cid = s.source.collectionId;
        list = pub.filter((p) => p.collectionIds.includes(cid));
        const col = db.collections.find((c) => c.id === cid && c.status === "published");
        if (col) href = `/collections/${col.handle}`;
      }
      return { ...s, products: list.slice(0, s.limit).map(toCard), href };
    }
    if (s.type === "hero") {
      const stats = (s.stats ?? []).map((st) => ({
        ...st,
        value: st.source === "collections" ? db.collections.filter((c) => c.status === "published").length : st.source === "products" ? pub.filter((p) => p.availability !== "out_of_stock").length : st.value,
      }));
      return { ...s, stats, spotlight: pub.filter((p) => p.featured).slice(0, 2).map(toCard) };
    }
    if (s.type === "faq") {
      const page = db.pages.find((p) => p.slug === "faq");
      const items = (page?.blocks ?? []).flatMap((b) => (b.kind === "qa" ? [{ question: b.question, answer: b.answer }] : [])).slice(0, s.limit);
      return { ...s, items };
    }
    if (s.type === "reviews") {
      return { ...s, reviews: db.reviews.filter((r) => r.status === "published" && r.rating >= 4).slice(0, 6) };
    }
    return s;
  });
  const colSection = sections.find((s) => s.type === "collections");
  const ids = colSection && colSection.type === "collections" ? colSection.collectionIds : [];
  const collections = sortedCollections(db).filter((c) => c.status === "published" && (ids.length === 0 || ids.includes(c.id)));
  return { sections: resolved, collections, updatedAt: now() };
}

function inventoryRow(p: Product, v: Variant): InventoryRow {
  return {
    productId: p.id,
    productTitle: p.title,
    variantId: v.id,
    variantTitle: v.title,
    sku: v.sku,
    available: v.inventory.available,
    tracked: v.inventory.tracked,
    policy: v.inventory.policy,
    lowStockThreshold: v.inventory.lowStockThreshold,
    availability: v.availability,
  };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseProductQuery(q: Record<string, unknown> | undefined): ProductQuery {
  return {
    q: (q?.q as string) || undefined,
    sort: (q?.sort as ProductSort) || undefined,
    page: num(q?.page, 1),
    pageSize: num(q?.pageSize, 12),
    options: decodeOptions(q?.options as string | undefined),
    minPrice: q?.minPrice !== undefined && q.minPrice !== "" ? num(q.minPrice, 0) : undefined,
    maxPrice: q?.maxPrice !== undefined && q.maxPrice !== "" ? num(q.maxPrice, 0) : undefined,
    inStock: bool(q?.inStock),
  };
}

export const handlers: Handlers = {
  /* storefront */
  getStoreSettings: (_r, _c, db) => db.settings,
  getNavigation: (_r, _c, db) => db.navigation,
  getHomepage: (_r, _c, db) => homepage(db, false),
  getContentPage: ({ params }, _c, db) => db.pages.find((p) => p.slug === params.slug) ?? fail(404, "not_found", "Page not found."),
  getPaymentOptions: (_r, _c, db) => {
    const m: { method: "paystack" | "flutterwave" | "bank_transfer" | "pay_on_delivery"; label: string; description: string }[] = [];
    if (db.payments.paystack.enabled) m.push({ method: "paystack", label: "Card, USSD or bank (Paystack)", description: "You'll be sent to Paystack to pay securely." });
    if (db.payments.flutterwave.enabled) m.push({ method: "flutterwave", label: "Card or bank (Flutterwave)", description: "You'll be sent to Flutterwave to pay securely." });
    if (db.payments.bankTransfer.enabled) m.push({ method: "bank_transfer", label: "Bank transfer", description: `We'll hold your order for ${db.payments.bankTransfer.holdHours} hours while you transfer.` });
    if (db.payments.payOnDelivery.enabled) m.push({ method: "pay_on_delivery", label: "Pay on delivery", description: `Available in ${db.payments.payOnDelivery.states.join(", ")}. Pay the rider by transfer or POS.` });
    return { methods: m };
  },
  listCollections: (_r, _c, db) => sortedCollections(db).filter((c) => c.status === "published"),
  getCollection: ({ params, query }, _c, db) => {
    const collection = db.collections.find((c) => c.handle === params.handle && c.status === "published") ?? fail(404, "not_found", "Collection not found.");
    const base = published(db).filter((p) => p.collectionIds.includes(collection.id));
    return { collection, listing: buildListing(db, base, parseProductQuery(query as Record<string, unknown>)) };
  },
  listProducts: ({ query }, _c, db) => {
    const q = parseProductQuery(query as Record<string, unknown>);
    const handle = (query as { collection?: string } | undefined)?.collection;
    const col = handle ? db.collections.find((c) => c.handle === handle) : undefined;
    const ids = (query as { ids?: string } | undefined)?.ids?.split(",").filter(Boolean);
    const base = published(db).filter((p) => (!col || p.collectionIds.includes(col.id)) && (!ids || ids.includes(p.id)));
    return buildListing(db, base, q);
  },
  getProduct: ({ params }, _c, db) => {
    const product = published(db).find((p) => p.handle === params.handle) ?? fail(404, "not_found", "Product not found.");
    const collections = db.collections.filter((c) => product.collectionIds.includes(c.id) && c.status === "published").map(({ id, handle, title }) => ({ id, handle, title }));
    const related = published(db)
      .filter((p) => p.id !== product.id && p.collectionIds.some((c) => product.collectionIds.includes(c)))
      .slice(0, 4)
      .map(toCard);
    const type = db.productTypes.find((t) => t.id === product.productTypeId);
    return { product, productType: type ? { id: type.id, name: type.name } : null, attributes: resolveAttributes(db, product), collections, related };
  },
  listProductReviews: ({ params, query }, _c, db) =>
    paginate(
      db.reviews.filter((r) => r.productId === params.productId && r.status === "published").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      num(query?.page, 1),
      6,
    ),
  createProductReview: ({ params, body }, _c, db) => {
    const p = db.products.find((x) => x.id === params.productId) ?? fail(404, "not_found", "Product not found.");
    const fields: Record<string, string> = {};
    if (!body.author.trim()) fields.author = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(body.email)) fields.email = "Enter a valid email address.";
    if (body.rating < 1 || body.rating > 5) fields.rating = "Choose a rating from 1 to 5.";
    if (body.body.trim().length < 10) fields.body = "Tell us a little more (at least 10 characters).";
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
    db.reviews.unshift({
      id: newId("rev"),
      productId: p.id,
      productTitle: p.title,
      author: body.author.trim(),
      location: body.location?.trim() || null,
      rating: Math.round(body.rating),
      title: body.title.trim() || "Review",
      body: body.body.trim(),
      verifiedPurchase: false,
      status: "pending",
      reply: null,
      createdAt: now(),
    });
    return { status: "pending" };
  },
  search: ({ query }, _c, db) => {
    const q = (query?.q ?? "").trim();
    const products = buildListing(db, published(db), { q, page: num(query?.page, 1), pageSize: 24 });
    const collections = q
      ? sortedCollections(db)
          .filter((c) => c.status === "published" && `${c.title} ${c.summary}`.toLowerCase().includes(q.toLowerCase()))
          .map(({ id, handle, title, summary, image }) => ({ id, handle, title, summary, image }))
      : [];
    const suggestions = products.total === 0 ? ["bone straight", "bob", "613", "braids", "bonnet"] : [];
    return { query: q, products, collections, suggestions };
  },

  /* cart */
  createCart: ({ body }, _c, db) => {
    const cart: MockCart = { id: newId("cart"), lines: [], codes: [], notices: [], updatedAt: now() };
    if (body.lines?.length) addLines(db, cart, body.lines);
    db.carts.set(cart.id, cart);
    return computeCart(db, cart);
  },
  getCart: ({ params }, _c, db) => computeCart(db, getCartOr404(db, params.cartId)),
  addCartLines: ({ params, body }, _c, db) => {
    const cart = getCartOr404(db, params.cartId);
    addLines(db, cart, body.lines);
    return computeCart(db, cart);
  },
  updateCartLine: ({ params, body }, _c, db) => {
    const cart = getCartOr404(db, params.cartId);
    const line = cart.lines.find((l) => l.id === params.lineId) ?? fail(404, "line_not_found", "That item is no longer in your bag.");
    const qty = Math.floor(body.quantity);
    if (qty <= 0) cart.lines = cart.lines.filter((l) => l.id !== line.id);
    else {
      const found = findVariant(db, line.variantId);
      const max = found && found.variant.inventory.tracked && found.variant.inventory.policy === "deny" ? found.variant.inventory.available : 20;
      if (qty > max) fail(409, "insufficient_stock", `Only ${max} available.`);
      line.quantity = qty;
    }
    cart.updatedAt = now();
    return computeCart(db, cart);
  },
  removeCartLine: ({ params }, _c, db) => {
    const cart = getCartOr404(db, params.cartId);
    cart.lines = cart.lines.filter((l) => l.id !== params.lineId);
    cart.updatedAt = now();
    return computeCart(db, cart);
  },
  applyDiscount: ({ params, body }, _c, db) => {
    const cart = getCartOr404(db, params.cartId);
    const code = body.code.trim().toUpperCase();
    const d = db.discounts.find((x) => x.code === code);
    if (!d) fail(422, "invalid_code", `${code || "That code"} isn't a valid code.`, { code: "Check the code and try again." });
    const st = discountStatus(d!);
    if (st !== "active") fail(422, "code_inactive", st === "scheduled" ? `${code} isn't active yet.` : `${code} has expired.`, { code: "This code can't be used right now." });
    if (!cart.codes.includes(code)) cart.codes = [code];
    cart.updatedAt = now();
    return computeCart(db, cart);
  },
  removeDiscount: ({ params }, _c, db) => {
    const cart = getCartOr404(db, params.cartId);
    cart.codes = cart.codes.filter((c) => c !== params.code.toUpperCase());
    return computeCart(db, cart);
  },

  /* checkout */
  getShippingRates: ({ body }, _c, db) => {
    const mcart = getCartOr404(db, body.cartId);
    const cart = computeCart(db, mcart);
    if (!body.address.state) fail(422, "validation_failed", "Choose a state to see delivery options.", { state: "Choose your state." });
    return ratesFor(db, body.address.state, cart.totals.subtotal - cart.totals.discountTotal, body.address.city).map((r) => {
      const t = computeCart(db, mcart, r.amount).totals;
      return { ...r, totals: { ...t, shippingTotal: t.shippingTotal ?? 0 } };
    });
  },
  placeOrder: ({ body }, _c, db) => {
    const prior = db.idempotency.get(body.idempotencyKey);
    if (prior) {
      const o = db.orders.find((x) => x.id === prior)!;
      return { order: summary(o), payment: paymentSessionFor(db, o) };
    }
    const mcart = getCartOr404(db, body.cartId);
    const fields: Record<string, string> = {};
    const a = body.shippingAddress;
    if (!/^\S+@\S+\.\S+$/.test(body.contact.email)) fields.email = "Enter a valid email address.";
    if (!isNigerianPhone(body.contact.phone)) fields.phone = PHONE_ERROR;
    if (!a.firstName.trim()) fields.firstName = "Enter a first name.";
    if (!a.lastName.trim()) fields.lastName = "Enter a last name.";
    if (!a.line1.trim()) fields.line1 = "Enter a street address.";
    if (!a.city.trim()) fields.city = "Enter a city or area.";
    if (!a.state) fields.state = "Choose a state.";
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);

    const preview = computeCart(db, mcart);
    if (!preview.lines.length) fail(409, "cart_empty", "Your bag is empty.");
    if (preview.notices.length) {
      mcart.notices = preview.notices;
      fail(409, "cart_changed", preview.notices.join(" "));
    }
    const rates = ratesFor(db, a.state, preview.totals.subtotal - preview.totals.discountTotal, a.city);
    const rate = rates.find((r) => r.id === body.shippingRateId) ?? fail(422, "invalid_shipping", "That delivery option isn't available for your state. Choose another.");
    const cart = computeCart(db, mcart, rate.amount);

    const pm = body.paymentMethod;
    const ps = db.payments;
    const enabled = (pm === "paystack" && ps.paystack.enabled) || (pm === "flutterwave" && ps.flutterwave.enabled) || (pm === "bank_transfer" && ps.bankTransfer.enabled) || (pm === "pay_on_delivery" && ps.payOnDelivery.enabled);
    if (!enabled) fail(422, "payment_unavailable", "That payment method isn't available. Choose another.");
    if (pm === "pay_on_delivery") {
      if (!ps.payOnDelivery.states.includes(a.state)) fail(422, "payment_unavailable", `Pay on delivery is only available in ${ps.payOnDelivery.states.join(", ")}.`);
      if (ps.payOnDelivery.maxOrderTotal && cart.totals.total > ps.payOnDelivery.maxOrderTotal) fail(422, "payment_unavailable", "This order is above the pay on delivery limit. Choose another payment method.");
    }

    // Reserve stock.
    for (const l of cart.lines) {
      const f = findVariant(db, l.variantId)!;
      if (f.variant.inventory.tracked) f.variant.inventory.available -= l.quantity;
      refreshProduct(f.product);
    }
    for (const d of cart.discounts) {
      const disc = db.discounts.find((x) => x.code === d.code);
      if (disc) disc.usageCount++;
    }

    const number = `QP-${++db.seq}`;
    const order: Order = {
      id: newId("ord"),
      number,
      accessToken: newId("tok"),
      status: "open",
      paymentStatus: pm === "bank_transfer" ? "awaiting_transfer" : "pending",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: pm,
      email: body.contact.email.trim().toLowerCase(),
      totals: { ...cart.totals, shippingTotal: cart.totals.shippingTotal ?? 0 },
      itemCount: cart.itemCount,
      createdAt: now(),
      lines: cart.lines.map((l) => ({ id: newId("ol"), productId: l.productId, variantId: l.variantId, title: l.productTitle, variantTitle: l.variantTitle, sku: findVariant(db, l.variantId)!.variant.sku, image: l.image, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
      contact: body.contact,
      shippingAddress: a,
      shippingRate: { id: rate.id, label: rate.label, etaDays: rate.etaDays },
      discounts: cart.discounts,
      trackingNumber: null,
      carrier: null,
      note: body.note?.trim() || null,
      bankTransfer: null,
      timeline: [],
    };
    if (pm === "bank_transfer") {
      order.bankTransfer = {
        bankName: ps.bankTransfer.bankName,
        accountName: ps.bankTransfer.accountName,
        accountNumber: ps.bankTransfer.accountNumber,
        reference: number,
        amount: order.totals.total,
        expiresAt: new Date(Date.now() + ps.bankTransfer.holdHours * 3600_000).toISOString(),
      };
    }
    event(order, "placed", "Order placed. (Mock mode: no payment provider is connected and no money has moved.)");
    db.orders.unshift(order);
    db.idempotency.set(body.idempotencyKey, order.id);
    db.carts.delete(mcart.id);
    return { order: summary(order), payment: paymentSessionFor(db, order) };
  },
  getOrder: ({ params, query }, _c, db) => {
    const o = db.orders.find((x) => x.number === params.number && x.accessToken === query?.token) ?? fail(404, "not_found", "We couldn't find that order. Check the link in your confirmation email.");
    return publicOrder(o);
  },
  trackOrder: ({ body }, _c, db) => {
    const o = db.orders.find((x) => x.number.toUpperCase() === body.number.trim().toUpperCase() && x.email === body.email.trim().toLowerCase());
    if (!o) fail(404, "not_found", "No order matches that number and email. Check both and try again.");
    return publicOrder(o!);
  },
  verifyPayment: ({ params, body }, _c, db) => {
    const o = db.orders.find((x) => x.number === params.number && x.accessToken === body.token) ?? fail(404, "not_found", "Order not found.");
    // Mock mode has no provider to verify with, so the status never changes here.
    return publicOrder(o);
  },

  /* engagement */
  createInquiry: ({ body }, _c, db) => {
    const fields: Record<string, string> = {};
    if (!body.name.trim()) fields.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(body.email)) fields.email = "Enter a valid email address.";
    if (body.message.trim().length < 10) fields.message = "Tell us a little more (at least 10 characters).";
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
    const inq = { id: newId("inq"), name: body.name.trim(), email: body.email.trim(), phone: body.phone?.trim() || null, topic: body.topic, orderNumber: body.orderNumber?.trim() || null, message: body.message.trim(), status: "new" as const, replies: [], createdAt: now() };
    db.inquiries.unshift(inq);
    return { id: inq.id, status: "new" };
  },
  subscribeNewsletter: ({ body }, _c, db) => {
    if (!/^\S+@\S+\.\S+$/.test(body.email)) fail(422, "validation_failed", "Enter a valid email address.", { email: "Enter a valid email address." });
    db.newsletter.add(body.email.trim().toLowerCase());
    return { ok: true };
  },

  /* customer */
  customerLogin: ({ body }, ctx, db) => {
    const account = db.accounts.find((a) => a.customer.email === body.email.trim().toLowerCase());
    if (!account || account.password !== body.password) fail(401, "invalid_credentials", "That email and password don't match an account.");
    return startCustomerSession(db, ctx, account!);
  },
  customerRegister: ({ body }, ctx, db) => {
    const email = body.email.trim().toLowerCase();
    const fields: Record<string, string> = {};
    if (!body.firstName.trim()) fields.firstName = "Enter your first name.";
    if (!body.lastName.trim()) fields.lastName = "Enter your last name.";
    if (!EMAIL.test(email)) fields.email = "Enter a valid email address.";
    if (body.password.length < 8) fields.password = "Use at least 8 characters.";
    if (body.phone?.trim() && !isNigerianPhone(body.phone)) fields.phone = PHONE_ERROR;
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
    if (db.accounts.some((a) => a.customer.email === email)) fail(409, "email_taken", "An account already uses this email. Sign in or reset your password.", { email: "This email already has an account." });
    const account: MockCustomerAccount = {
      customer: { id: newId("cus"), firstName: body.firstName.trim(), lastName: body.lastName.trim(), email, phone: body.phone?.trim() || null, createdAt: now() },
      password: body.password,
      addresses: [],
      wishlist: [],
      marketingOptIn: body.marketingOptIn,
    };
    db.accounts.push(account);
    if (body.marketingOptIn) db.newsletter.add(email);
    return startCustomerSession(db, ctx, account);
  },
  customerRequestPasswordReset: ({ body }, _c, db) => {
    const account = db.accounts.find((a) => a.customer.email === body.email.trim().toLowerCase());
    // The live backend emails a link to /account/reset?token=… . Mock mode sends nothing.
    if (account) {
      const token = newId("reset");
      db.passwordResets.set(token, { customerId: account.customer.id, expiresAt: Date.now() + 3600_000 });
      // Mock only: there is no email, so the link is printed to the server log for testing.
      if (process.env.NODE_ENV !== "test") console.info(`[mock] password reset link: /account/reset?token=${token}`);
    }
    return { ok: true };
  },
  customerResetPassword: ({ body }, _c, db) => {
    const r = db.passwordResets.get(body.token);
    if (!r || r.expiresAt < Date.now()) fail(410, "reset_expired", "This reset link has expired or was already used. Request a new one.");
    if (body.password.length < 8) fail(422, "validation_failed", "Use at least 8 characters.", { password: "Use at least 8 characters." });
    const account = db.accounts.find((a) => a.customer.id === r!.customerId);
    if (account) account.password = body.password;
    db.passwordResets.delete(body.token);
    return { ok: true };
  },
  customerLogout: (_r, ctx, db) => {
    const t = ctx.getCookie(CUSTOMER_COOKIE);
    if (t) db.customerSessions.delete(t);
    ctx.clearCookie(CUSTOMER_COOKIE);
    return { ok: true };
  },
  getCustomer: (_r, ctx, db) => ({ customer: requireCustomer(db, ctx) }),
  getCustomerAccount: (_r, ctx, db) => requireCustomer(db, ctx),
  listCustomerOrders: (_r, ctx, db) => {
    const c = requireCustomer(db, ctx);
    return db.orders.filter((o) => o.email === c.email).map(summary);
  },
  getWishlist: (_r, ctx, db) => ({ productIds: requireAccount(db, ctx).wishlist }),
  replaceWishlist: ({ body }, ctx, db) => {
    const a = requireAccount(db, ctx);
    a.wishlist = [...new Set(body.productIds)].filter((id) => db.products.some((p) => p.id === id));
    return { productIds: a.wishlist };
  },
  listAddresses: (_r, ctx, db) => requireAccount(db, ctx).addresses,
  saveAddress: ({ body }, ctx, db) => {
    const a = requireAccount(db, ctx);
    const fields = validateAddress(body);
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
    const address: SavedAddress = { ...body, id: body.id ?? newId("addr"), label: body.label?.trim() || "Address", country: "NG" };
    if (address.isDefault || a.addresses.length === 0) {
      a.addresses.forEach((x) => (x.isDefault = false));
      address.isDefault = true;
    }
    a.addresses = body.id ? a.addresses.map((x) => (x.id === body.id ? address : x)) : [...a.addresses, address];
    return a.addresses;
  },
  deleteAddress: ({ params }, ctx, db) => {
    const a = requireAccount(db, ctx);
    a.addresses = a.addresses.filter((x) => x.id !== params.id);
    if (a.addresses.length && !a.addresses.some((x) => x.isDefault)) a.addresses[0]!.isDefault = true;
    return a.addresses;
  },

  /* admin auth */
  adminLogin: ({ body }, ctx, db) => {
    const email = body.email.trim().toLowerCase();
    const staff = db.staff.find((s) => s.email === email);
    if (!staff || db.staffPasswords[email] !== body.password) fail(401, "invalid_credentials", "That email and password don't match a staff account.");
    if (staff!.status !== "active") fail(403, "inactive", "This staff account is suspended. Ask the store owner to reactivate it.");
    const token = newId("as");
    db.adminSessions.set(token, { staffId: staff!.id, expiresAt: Date.now() + 8 * 3600_000 });
    staff!.lastActiveAt = now();
    ctx.setCookie(ADMIN_COOKIE, token, 8 * 3600);
    return adminSession(db, { ...ctx, getCookie: (n) => (n === ADMIN_COOKIE ? token : ctx.getCookie(n)) });
  },
  adminLogout: (_r, ctx, db) => {
    const t = ctx.getCookie(ADMIN_COOKIE);
    if (t) db.adminSessions.delete(t);
    ctx.clearCookie(ADMIN_COOKIE);
    return { ok: true };
  },
  adminSession: (_r, ctx, db) => adminSession(db, ctx),

  /* dashboard */
  adminDashboard: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "dashboard:read");
    const days = num(query?.days, 30);
    const since = Date.now() - days * 86400_000;
    const prevSince = since - days * 86400_000;
    const counted = (o: Order) => ["paid", "partially_refunded"].includes(o.paymentStatus);
    const inRange = db.orders.filter((o) => Date.parse(o.createdAt) >= since);
    const prev = db.orders.filter((o) => Date.parse(o.createdAt) >= prevSince && Date.parse(o.createdAt) < since);
    const revenue = inRange.filter(counted).reduce((s, o) => s + o.totals.total, 0);
    const prevRevenue = prev.filter(counted).reduce((s, o) => s + o.totals.total, 0);
    const series: DashboardSummary["revenueSeries"] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, amount: inRange.filter((o) => counted(o) && o.createdAt.slice(0, 10) === key).reduce((s, o) => s + o.totals.total, 0) });
    }
    const top = new Map<string, { productId: string; title: string; unitsSold: number; revenue: number }>();
    for (const o of inRange.filter(counted)) {
      for (const l of o.lines) {
        const t = top.get(l.productId) ?? { productId: l.productId, title: l.title, unitsSold: 0, revenue: 0 };
        t.unitsSold += l.quantity;
        t.revenue += l.lineTotal;
        top.set(l.productId, t);
      }
    }
    const paidCount = inRange.filter(counted).length;
    return {
      periodDays: days,
      revenue,
      revenueChangePct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
      orders: inRange.length,
      averageOrderValue: paidCount ? Math.round(revenue / paidCount) : 0,
      awaitingPayment: db.orders.filter((o) => o.status === "open" && ["pending", "awaiting_transfer"].includes(o.paymentStatus)).length,
      awaitingFulfillment: db.orders.filter((o) => o.status === "open" && o.paymentStatus === "paid" && ["unfulfilled", "processing"].includes(o.fulfillmentStatus)).length,
      newInquiries: db.inquiries.filter((i) => i.status === "new").length,
      pendingReviews: db.reviews.filter((r) => r.status === "pending").length,
      revenueSeries: series,
      lowStock: db.products
        .flatMap((p) => p.variants.filter((v) => v.inventory.tracked && v.inventory.available <= v.inventory.lowStockThreshold).map((v) => ({ variantId: v.id, productId: p.id, productTitle: p.title, variantTitle: v.title, sku: v.sku, available: v.inventory.available })))
        .sort((a, b) => a.available - b.available)
        .slice(0, 8),
      recentOrders: db.orders.slice(0, 6).map(summary),
      topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  },

  /* products */
  adminListProducts: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    let list = [...db.products];
    if (query?.q) list = list.filter((p) => matchesQuery(p, query.q!) || p.variants.some((v) => v.sku.toLowerCase().includes(query.q!.toLowerCase())));
    if (query?.status) list = list.filter((p) => p.status === query.status);
    if (query?.collectionId === "none") list = list.filter((p) => p.collectionIds.length === 0);
    else if (query?.collectionId) list = list.filter((p) => p.collectionIds.includes(query.collectionId!));
    if (query?.productTypeId) list = list.filter((p) => p.productTypeId === query.productTypeId);
    list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return paginate(list, num(query?.page, 1), num(query?.pageSize, 20));
  },
  adminGetProduct: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    return db.products.find((p) => p.id === params.id) ?? fail(404, "not_found", "Product not found.");
  },
  adminCreateProduct: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    return saveProduct(db, null, body);
  },
  adminUpdateProduct: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    const existing = db.products.find((p) => p.id === params.id) ?? fail(404, "not_found", "Product not found.");
    return saveProduct(db, existing, body);
  },
  adminDeleteProduct: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    db.products = db.products.filter((p) => p.id !== params.id);
    refreshAll(db);
    return { ok: true };
  },
  adminDuplicateProduct: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    const src = db.products.find((p) => p.id === params.id) ?? fail(404, "not_found", "Product not found.");
    let n = 1;
    const base = `${src.handle}-copy`;
    let handle = base;
    while (db.products.some((p) => p.handle === handle)) handle = `${base}-${++n}`;
    const id = newId("prod");
    const copy: Product = {
      ...structuredClone(src),
      id,
      handle,
      title: `${src.title} (copy)`,
      status: "draft",
      featured: false,
      variants: src.variants.map((v) => ({ ...structuredClone(v), id: newId("var"), productId: id, sku: `${v.sku}-COPY${n > 1 ? n : ""}`, inventory: { ...v.inventory, available: 0 } })),
      rating: { average: 0, count: 0 },
      createdAt: now(),
      updatedAt: now(),
    };
    refreshProduct(copy);
    db.products.unshift(copy);
    refreshAll(db);
    return copy;
  },
  adminListProductTypes: (_r, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    refreshAll(db);
    return db.productTypes;
  },
  adminSaveProductType: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    const fields: Record<string, string> = {};
    if (!body.name.trim()) fields.name = "Name the product type.";
    const keys = body.attributes.map((a) => a.key);
    if (body.attributes.some((a) => !a.label.trim())) fields.attributes = "Every field needs a label.";
    else if (new Set(keys).size !== keys.length) fields.attributes = "Two fields have the same name. Rename one.";
    if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
    const clean = {
      name: body.name.trim(),
      description: body.description,
      optionNames: body.optionNames.map((o) => o.trim()).filter(Boolean),
      attributes: body.attributes.map((a) => ({ ...a, key: a.key || slugify(a.label).replace(/-/g, "_") })),
    };
    if (body.id) {
      const t = db.productTypes.find((x) => x.id === body.id) ?? fail(404, "not_found", "Product type not found.");
      Object.assign(t, clean);
      refreshAll(db);
      return t;
    }
    const t = { id: newId("type"), ...clean, productCount: 0 };
    db.productTypes.push(t);
    return t;
  },
  adminDeleteProductType: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    const inUse = db.products.filter((p) => p.productTypeId === params.id).length;
    if (inUse) fail(409, "in_use", `${inUse} product${inUse === 1 ? " uses" : "s use"} this type. Change their type first.`);
    db.productTypes = db.productTypes.filter((t) => t.id !== params.id);
    return { ok: true };
  },
  adminUpdateVariant: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "products:write");
    const p = db.products.find((x) => x.id === params.productId) ?? fail(404, "not_found", "Product not found.");
    const v = p.variants.find((x) => x.id === params.variantId) ?? fail(404, "not_found", "Variant not found.");
    if (body.price !== undefined) {
      if (!Number.isInteger(body.price) || body.price <= 0) fail(422, "validation_failed", "Price must be more than ₦0.", { price: "Enter a price above ₦0." });
      v.price = body.price;
    }
    if (body.compareAtPrice !== undefined) v.compareAtPrice = body.compareAtPrice;
    if (body.sku !== undefined) v.sku = body.sku;
    refreshProduct(p);
    p.updatedAt = now();
    return v;
  },

  /* inventory */
  adminListInventory: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    let rows = db.products.flatMap((p) => p.variants.map((v) => inventoryRow(p, v)));
    if (query?.q) {
      const q = query.q.toLowerCase();
      rows = rows.filter((r) => `${r.productTitle} ${r.variantTitle} ${r.sku}`.toLowerCase().includes(q));
    }
    if (bool(query?.lowOnly)) rows = rows.filter((r) => r.tracked && r.available <= r.lowStockThreshold);
    return rows;
  },
  adminAdjustInventory: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "inventory:write");
    const f = findVariant(db, body.variantId) ?? fail(404, "not_found", "Variant not found.");
    const next = f.variant.inventory.available + Math.trunc(body.delta);
    if (next < 0) fail(422, "validation_failed", "Stock can't go below zero.", { delta: `You can remove at most ${f.variant.inventory.available}.` });
    f.variant.inventory.available = next;
    refreshProduct(f.product);
    return inventoryRow(f.product, f.variant);
  },

  /* collections */
  adminListCollections: (_r, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    refreshAll(db);
    return sortedCollections(db);
  },
  adminCreateCollection: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "collections:write");
    const handle = slugify(body.handle || body.title);
    if (!body.title.trim()) fail(422, "validation_failed", "Give the collection a name.", { title: "Enter a name." });
    if (db.collections.some((c) => c.handle === handle)) fail(409, "handle_taken", "Another collection already uses that URL.", { handle: "Choose a different URL handle." });
    const c: Collection = {
      id: newId("col"),
      handle,
      title: body.title.trim(),
      summary: body.summary,
      description: body.description,
      image: body.imageId ? db.media.find((m) => m.id === body.imageId) ?? null : null,
      banner: body.bannerId ? db.media.find((m) => m.id === body.bannerId) ?? null : null,
      status: body.status,
      position: db.collections.length,
      productCount: 0,
      seo: body.seo ?? {},
      updatedAt: now(),
    };
    db.collections.push(c);
    return c;
  },
  adminUpdateCollection: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "collections:write");
    const c = db.collections.find((x) => x.id === params.id) ?? fail(404, "not_found", "Collection not found.");
    if (body.handle !== undefined) {
      const handle = slugify(body.handle);
      if (db.collections.some((x) => x.handle === handle && x.id !== c.id)) fail(409, "handle_taken", "Another collection already uses that URL.", { handle: "Choose a different URL handle." });
      c.handle = handle;
    }
    if (body.title !== undefined) c.title = body.title;
    if (body.summary !== undefined) c.summary = body.summary;
    if (body.description !== undefined) c.description = body.description;
    if (body.status !== undefined) c.status = body.status;
    if (body.seo !== undefined) c.seo = body.seo;
    if (body.imageId !== undefined) c.image = body.imageId ? db.media.find((m) => m.id === body.imageId) ?? null : null;
    if (body.bannerId !== undefined) c.banner = body.bannerId ? db.media.find((m) => m.id === body.bannerId) ?? null : null;
    c.updatedAt = now();
    refreshAll(db);
    return c;
  },
  adminDeleteCollection: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "collections:write");
    if (!db.collections.some((c) => c.id === params.id)) fail(404, "not_found", "Collection not found.");
    db.collections = db.collections.filter((c) => c.id !== params.id);
    // Products are kept; they only leave this collection.
    const unassignedProductIds: string[] = [];
    for (const p of db.products) {
      if (!p.collectionIds.includes(params.id)) continue;
      p.collectionIds = p.collectionIds.filter((id) => id !== params.id);
      if (p.collectionIds.length === 0) unassignedProductIds.push(p.id);
    }
    sortedCollections(db).forEach((c, i) => (c.position = i));
    db.homepage.forEach((s) => {
      if (s.type === "collections") s.collectionIds = s.collectionIds.filter((id) => id !== params.id);
    });
    return { ok: true as const, unassignedProductIds };
  },
  adminReorderCollections: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "collections:write");
    body.ids.forEach((id, i) => {
      const c = db.collections.find((x) => x.id === id);
      if (c) c.position = i;
    });
    return sortedCollections(db);
  },

  /* media */
  adminListMedia: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "products:read");
    const q = query?.q?.toLowerCase();
    return db.media.filter((m) => !q || `${m.alt} ${m.tags.join(" ")}`.toLowerCase().includes(q));
  },
  adminUploadMedia: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "media:write");
    if (!/^image\/(jpeg|png|webp|avif)$/.test(body.mimeType)) fail(422, "unsupported_type", "Upload a JPEG, PNG, WebP or AVIF image.");
    if (body.sizeBytes > 4 * 1024 * 1024) fail(422, "too_large", "Images must be 4 MB or smaller in mock mode.");
    const m: Media = { id: newId("med"), url: body.dataUrl, alt: body.alt, width: body.width, height: body.height, mimeType: body.mimeType, tags: body.tags, createdAt: now(), sizeBytes: body.sizeBytes };
    db.media.unshift(m);
    return m;
  },
  adminUpdateMedia: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "media:write");
    const m = db.media.find((x) => x.id === params.id) ?? fail(404, "not_found", "Image not found.");
    m.alt = body.alt;
    m.tags = body.tags;
    return m;
  },
  adminDeleteMedia: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "media:write");
    const used = db.products.some((p) => p.media.some((m) => m.id === params.id) || p.video?.poster?.id === params.id) || db.collections.some((c) => c.image?.id === params.id || c.banner?.id === params.id);
    if (used) fail(409, "in_use", "This image is used by a product or collection. Remove it there first.");
    db.media = db.media.filter((m) => m.id !== params.id);
    return { ok: true };
  },

  /* orders */
  adminListOrders: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "orders:read");
    let list = db.orders;
    if (query?.q) {
      const q = query.q.toLowerCase();
      list = list.filter((o) => `${o.number} ${o.email} ${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`.toLowerCase().includes(q));
    }
    if (query?.paymentStatus) list = list.filter((o) => o.paymentStatus === query.paymentStatus);
    if (query?.fulfillmentStatus) list = list.filter((o) => o.fulfillmentStatus === query.fulfillmentStatus);
    return paginate(list.map(summary), num(query?.page, 1), num(query?.pageSize, 20));
  },
  adminGetOrder: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "orders:read");
    return db.orders.find((o) => o.id === params.id) ?? fail(404, "not_found", "Order not found.");
  },
  adminUpdateFulfillment: ({ params, body }, ctx, db) => {
    const s = requirePerm(db, ctx, "orders:write");
    const o = db.orders.find((x) => x.id === params.id) ?? fail(404, "not_found", "Order not found.");
    if (o.status === "cancelled") fail(409, "order_cancelled", "This order was cancelled.");
    if (["shipped", "out_for_delivery", "delivered"].includes(body.fulfillmentStatus) && !["paid", "pending"].includes(o.paymentStatus)) {
      fail(409, "unpaid", "Confirm payment before shipping this order.");
    }
    o.fulfillmentStatus = body.fulfillmentStatus;
    if (body.carrier !== undefined) o.carrier = body.carrier || null;
    if (body.trackingNumber !== undefined) o.trackingNumber = body.trackingNumber || null;
    if (body.fulfillmentStatus === "delivered" && o.paymentStatus === "paid") o.status = "completed";
    event(o, "fulfillment", `Marked ${body.fulfillmentStatus.replace(/_/g, " ")}${o.trackingNumber ? ` (${o.carrier ?? "carrier"} ${o.trackingNumber})` : ""}.`);
    event(o, "note", `${s.staff.name} updated fulfilment${body.notifyCustomer ? " and asked to notify the customer (mock: no message sent)" : ""}.`, true);
    return o;
  },
  adminMarkTransferReceived: ({ params, body }, ctx, db) => {
    const s = requirePerm(db, ctx, "orders:write");
    const o = db.orders.find((x) => x.id === params.id) ?? fail(404, "not_found", "Order not found.");
    if (o.paymentStatus !== "awaiting_transfer") fail(409, "invalid_state", "This order isn't waiting for a transfer.");
    if (!body.reference.trim()) fail(422, "validation_failed", "Enter the bank reference.", { reference: "Enter the reference from your bank alert." });
    o.paymentStatus = "paid";
    event(o, "payment", "Bank transfer confirmed.");
    event(o, "note", `${s.staff.name} confirmed transfer ref ${body.reference}${body.note ? `: ${body.note}` : ""}.`, true);
    return o;
  },
  adminCancelOrder: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "orders:write");
    const o = db.orders.find((x) => x.id === params.id) ?? fail(404, "not_found", "Order not found.");
    if (["shipped", "out_for_delivery", "delivered"].includes(o.fulfillmentStatus)) fail(409, "already_shipped", "This order has shipped. Process a return instead.");
    o.status = "cancelled";
    if (["pending", "awaiting_transfer"].includes(o.paymentStatus)) o.paymentStatus = "cancelled";
    if (body.restock) {
      for (const l of o.lines) {
        const f = findVariant(db, l.variantId);
        if (f && f.variant.inventory.tracked) {
          f.variant.inventory.available += l.quantity;
          refreshProduct(f.product);
        }
      }
    }
    event(o, "cancelled", `Order cancelled: ${body.reason || "no reason given"}.${body.restock ? " Items restocked." : ""}`);
    return o;
  },
  adminRefundOrder: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "orders:refund");
    const o = db.orders.find((x) => x.id === params.id) ?? fail(404, "not_found", "Order not found.");
    if (!["paid", "partially_refunded"].includes(o.paymentStatus)) fail(409, "invalid_state", "Only paid orders can be refunded.");
    // Mock mode never moves money. The live backend calls the provider and only then updates status.
    fail(501, "mock_unsupported", "Refunds need the live payment provider. Nothing was refunded.");
    void body;
    return o;
  },
  adminAddOrderNote: ({ params, body }, ctx, db) => {
    const s = requirePerm(db, ctx, "orders:read");
    const o = db.orders.find((x) => x.id === params.id) ?? fail(404, "not_found", "Order not found.");
    if (!body.message.trim()) fail(422, "validation_failed", "Write a note first.");
    event(o, "note", `${s.staff.name}: ${body.message.trim()}`, true);
    return o;
  },

  /* content */
  adminGetHomepage: (_r, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    return homepage(db, true);
  },
  adminUpdateHomepage: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    db.homepage = body.sections.map((s, i) => {
      const clean = { ...s, position: i } as typeof s & { products?: unknown; reviews?: unknown };
      delete clean.products;
      delete clean.reviews;
      delete (clean as { spotlight?: unknown }).spotlight;
      return clean;
    });
    return homepage(db, true);
  },
  adminUpdateNavigation: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    db.navigation = body;
    return db.navigation;
  },

  adminGetNavigation: (_r, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    return db.navigation;
  },
  adminListPages: (_r, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    return db.pages;
  },
  adminSavePage: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "content:write");
    const page = db.pages.find((p) => p.slug === params.slug) ?? fail(404, "not_found", "Page not found.");
    if (!body.title.trim()) fail(422, "validation_failed", "Give the page a title.", { title: "Enter a title." });
    Object.assign(page, { title: body.title.trim(), intro: body.intro, blocks: body.blocks, reviewed: body.reviewed, updatedAt: now() });
    return page;
  },

  /* customers */
  adminListCustomers: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "customers:read");
    let list = customerSummaries(db);
    const q = query?.q?.trim().toLowerCase();
    if (q) list = list.filter((c) => `${c.name} ${c.email} ${c.phone ?? ""}`.toLowerCase().includes(q));
    return paginate(list, num(query?.page, 1), num(query?.pageSize, 20));
  },
  adminGetCustomer: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "customers:read");
    const c = customerSummaries(db).find((x) => x.id === params.id) ?? fail(404, "not_found", "Customer not found.");
    const account = db.accounts.find((a) => a.customer.email === c.email);
    return {
      ...c,
      orders: db.orders.filter((o) => o.email === c.email).map(summary),
      addresses: account?.addresses ?? [],
      marketingOptIn: account?.marketingOptIn ?? db.orders.some((o) => o.email === c.email && o.contact.marketingOptIn),
    };
  },

  /* analytics */
  adminAnalytics: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "analytics:read");
    return analytics(db, num(query?.days, 30));
  },

  /* search */
  adminSearch: ({ query }, ctx, db) => {
    const session = adminSession(db, ctx);
    const q = (query?.q ?? "").trim().toLowerCase();
    if (q.length < 2) return { products: [], orders: [], customers: [], collections: [] };
    const can = (p: Permission) => session.permissions.includes(p);
    return {
      products: can("products:read") ? db.products.filter((p) => `${p.title} ${p.subtitle} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q)).slice(0, 5).map((p) => ({ id: p.id, title: p.title, subtitle: p.subtitle })) : [],
      orders: can("orders:read") ? db.orders.filter((o) => `${o.number} ${o.email} ${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`.toLowerCase().includes(q)).slice(0, 5).map((o) => ({ id: o.id, number: o.number, email: o.email })) : [],
      customers: can("customers:read") ? customerSummaries(db).filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q)).slice(0, 5).map((c) => ({ id: c.id, name: c.name, email: c.email })) : [],
      collections: can("products:read") ? db.collections.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 5).map((c) => ({ id: c.id, title: c.title })) : [],
    };
  },

  /* discounts */
  adminListDiscounts: (_r, ctx, db) => {
    requirePerm(db, ctx, "discounts:write");
    return db.discounts.map((d) => ({ ...d, status: discountStatus(d) }));
  },
  adminCreateDiscount: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "discounts:write");
    const d = validateDiscount(db, body, null);
    db.discounts.unshift(d);
    return { ...d, status: discountStatus(d) };
  },
  adminUpdateDiscount: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "discounts:write");
    const existing = db.discounts.find((d) => d.id === params.id) ?? fail(404, "not_found", "Discount not found.");
    const d = validateDiscount(db, body, existing);
    Object.assign(existing, d);
    return { ...existing, status: discountStatus(existing) };
  },
  adminDeleteDiscount: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "discounts:write");
    db.discounts = db.discounts.filter((d) => d.id !== params.id);
    return { ok: true };
  },

  /* reviews & inquiries */
  adminListReviews: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "reviews:moderate");
    return db.reviews.filter((r) => !query?.status || r.status === query.status);
  },
  adminModerateReview: ({ params, body }, ctx, db) => {
    requirePerm(db, ctx, "reviews:moderate");
    const r: Review = db.reviews.find((x) => x.id === params.id) ?? fail(404, "not_found", "Review not found.");
    r.status = body.status;
    if (body.reply !== undefined) r.reply = body.reply?.trim() || null;
    return r;
  },
  adminListInquiries: ({ query }, ctx, db) => {
    requirePerm(db, ctx, "inquiries:respond");
    return db.inquiries.filter((i) => !query?.status || i.status === query.status);
  },
  adminUpdateInquiry: ({ params, body }, ctx, db) => {
    const s = requirePerm(db, ctx, "inquiries:respond");
    const i = db.inquiries.find((x) => x.id === params.id) ?? fail(404, "not_found", "Message not found.");
    if (body.reply?.trim()) {
      i.replies.push({ id: newId("rep"), author: s.staff.name, body: body.reply.trim(), createdAt: now() });
      if (i.status === "new") i.status = "open";
    }
    if (body.status) i.status = body.status;
    return i;
  },

  /* settings */
  adminGetShippingSettings: (_r, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    return db.shipping;
  },
  adminUpdateShippingSettings: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    for (const z of body.zones) for (const r of z.rates) if (!Number.isInteger(r.amount) || r.amount < 0) fail(422, "validation_failed", `Check the fee for ${r.label || "a rate"} in ${z.name}.`);
    db.shipping = body;
    return db.shipping;
  },
  adminGetPaymentSettings: (_r, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    return db.payments;
  },
  adminUpdatePaymentSettings: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    if (body.paystack.publicKey && !/^pk_(test|live)_/.test(body.paystack.publicKey)) fail(422, "validation_failed", "Paystack public keys start with pk_test_ or pk_live_.");
    const bt = body.bankTransfer;
    if (bt.enabled && (!bt.bankName.trim() || !bt.accountName.trim() || !/^\d{10}$/.test(bt.accountNumber.trim())))
      fail(422, "validation_failed", "To accept bank transfers, enter the bank name, account name and 10-digit account number.");
    db.payments = body;
    return db.payments;
  },
  adminGetStoreSettings: (_r, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    return db.settings;
  },
  adminUpdateStoreSettings: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "settings:write");
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const [k, v] of Object.entries(body.branding.colors)) if (!hex.test(v)) fail(422, "validation_failed", `Brand colour "${k}" must be a 6-digit hex value like #6B1630.`);
    if (body.contactEmail && !EMAIL.test(body.contactEmail)) fail(422, "validation_failed", "Enter a valid contact email, or leave it empty.");
    if (body.whatsapp && body.whatsapp.replace(/\D/g, "").length < 10) fail(422, "validation_failed", "Enter the WhatsApp number in full, e.g. +2348012345678, or leave it empty.");
    const { logoId, logoDarkId, ...rest } = body;
    const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
    db.settings = {
      ...rest,
      contactEmail: blank(rest.contactEmail),
      phone: blank(rest.phone),
      whatsapp: blank(rest.whatsapp),
      openingHours: blank(rest.openingHours),
      logo: logoId ? db.media.find((m) => m.id === logoId) ?? null : null,
      logoDark: logoDarkId ? db.media.find((m) => m.id === logoDarkId) ?? null : null,
    };
    return db.settings;
  },

  /* staff */
  adminListStaff: (_r, ctx, db) => {
    requirePerm(db, ctx, "staff:manage");
    return db.staff;
  },
  adminInviteStaff: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "staff:manage");
    const email = body.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, "validation_failed", "Enter a valid email.", { email: "Enter a valid email." });
    if (db.staff.some((s) => s.email === email)) fail(409, "exists", "That person already has a staff account.");
    if (!db.roles.some((r) => r.id === body.roleId)) fail(422, "validation_failed", "Choose a role.");
    const s = { id: newId("staff"), name: body.name.trim() || email, email, roleId: body.roleId, status: "invited" as const, lastActiveAt: null };
    db.staff.push(s);
    return s;
  },
  adminUpdateStaff: ({ params, body }, ctx, db) => {
    const me = requirePerm(db, ctx, "staff:manage");
    const s = db.staff.find((x) => x.id === params.id) ?? fail(404, "not_found", "Staff member not found.");
    if (s.id === me.staff.id && (body.status === "suspended" || (body.roleId && body.roleId !== s.roleId))) fail(409, "self_lockout", "You can't change your own role or suspend yourself.");
    Object.assign(s, body);
    return s;
  },
  adminRemoveStaff: ({ params }, ctx, db) => {
    const me = requirePerm(db, ctx, "staff:manage");
    if (params.id === me.staff.id) fail(409, "self_lockout", "You can't remove yourself.");
    db.staff = db.staff.filter((s) => s.id !== params.id);
    return { ok: true };
  },
  adminListRoles: (_r, ctx, db) => {
    adminSession(db, ctx);
    return db.roles;
  },
  adminSaveRole: ({ body }, ctx, db) => {
    requirePerm(db, ctx, "staff:manage");
    if (!body.name.trim()) fail(422, "validation_failed", "Name the role.");
    if (body.id) {
      const r = db.roles.find((x) => x.id === body.id) ?? fail(404, "not_found", "Role not found.");
      if (r.system) fail(409, "system_role", "The Owner role can't be changed.");
      Object.assign(r, { name: body.name, description: body.description, permissions: body.permissions });
      return r;
    }
    const r = { id: newId("role"), name: body.name.trim(), description: body.description, permissions: body.permissions, system: false };
    db.roles.push(r);
    return r;
  },
  adminDeleteRole: ({ params }, ctx, db) => {
    requirePerm(db, ctx, "staff:manage");
    const r = db.roles.find((x) => x.id === params.id) ?? fail(404, "not_found", "Role not found.");
    if (r.system) fail(409, "system_role", "The Owner role can't be deleted.");
    if (db.staff.some((s) => s.roleId === r.id)) fail(409, "in_use", "Move staff off this role before deleting it.");
    db.roles = db.roles.filter((x) => x.id !== r.id);
    return { ok: true };
  },
};

function customerSummaries(db: MockDb): CustomerSummary[] {
  const byEmail = new Map<string, CustomerSummary>();
  for (const a of db.accounts) {
    const c = a.customer;
    byEmail.set(c.email, { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone, hasAccount: true, orderCount: 0, totalPaid: 0, lastOrderAt: null, createdAt: c.createdAt });
  }
  for (const o of [...db.orders].reverse()) {
    let c = byEmail.get(o.email);
    if (!c) {
      c = { id: `guest_${o.email.replace(/[^a-z0-9]/gi, "_")}`, name: `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`.trim(), email: o.email, phone: o.contact.phone, hasAccount: false, orderCount: 0, totalPaid: 0, lastOrderAt: null, createdAt: o.createdAt };
      byEmail.set(o.email, c);
    }
    c.orderCount += 1;
    if (["paid", "partially_refunded"].includes(o.paymentStatus)) c.totalPaid += o.totals.total;
    if (!c.lastOrderAt || o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
  }
  return [...byEmail.values()].sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
}

function analytics(db: MockDb, days: number): AnalyticsReport {
  const since = Date.now() - days * 86400_000;
  const inRange = db.orders.filter((o) => Date.parse(o.createdAt) >= since);
  const paid = inRange.filter((o) => ["paid", "partially_refunded"].includes(o.paymentStatus));
  const revenue = paid.reduce((s, o) => s + o.totals.total, 0);
  const series: AnalyticsReport["series"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    const day = paid.filter((o) => o.createdAt.slice(0, 10) === key);
    series.push({ date: key, revenue: day.reduce((s, o) => s + o.totals.total, 0), orders: inRange.filter((o) => o.createdAt.slice(0, 10) === key).length });
  }
  const colMap = new Map<string, { collectionId: string | null; title: string; revenue: number; units: number }>();
  const prodMap = new Map<string, { productId: string; title: string; unitsSold: number; revenue: number }>();
  for (const o of paid) {
    for (const l of o.lines) {
      const p = db.products.find((x) => x.id === l.productId);
      const cid = p?.collectionIds[0] ?? null;
      const ck = cid ?? "none";
      const col = colMap.get(ck) ?? { collectionId: cid, title: db.collections.find((c) => c.id === cid)?.title ?? "No collection", revenue: 0, units: 0 };
      col.revenue += l.lineTotal;
      col.units += l.quantity;
      colMap.set(ck, col);
      const pr = prodMap.get(l.productId) ?? { productId: l.productId, title: l.title, unitsSold: 0, revenue: 0 };
      pr.unitsSold += l.quantity;
      pr.revenue += l.lineTotal;
      prodMap.set(l.productId, pr);
    }
  }
  const group = <K extends string>(key: (o: Order) => K) => {
    const m = new Map<K, { orders: number; revenue: number }>();
    for (const o of inRange) {
      const g = m.get(key(o)) ?? { orders: 0, revenue: 0 };
      g.orders += 1;
      if (paid.includes(o)) g.revenue += o.totals.total;
      m.set(key(o), g);
    }
    return m;
  };
  const firstOrder = new Map<string, string>();
  for (const o of db.orders) if (!firstOrder.has(o.email) || o.createdAt < firstOrder.get(o.email)!) firstOrder.set(o.email, o.createdAt);
  const emails = new Set(inRange.map((o) => o.email));
  let newC = 0;
  emails.forEach((e) => (Date.parse(firstOrder.get(e)!) >= since ? newC++ : 0));
  const discountMap = new Map<string, { code: string; uses: number; amount: number }>();
  for (const o of paid) for (const d of o.discounts) {
    const x = discountMap.get(d.code) ?? { code: d.code, uses: 0, amount: 0 };
    x.uses += 1;
    x.amount += d.amount;
    discountMap.set(d.code, x);
  }
  return {
    periodDays: days,
    revenue,
    paidOrders: paid.length,
    allOrders: inRange.length,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
    unitsSold: paid.reduce((s, o) => s + o.itemCount, 0),
    series,
    byCollection: [...colMap.values()].sort((a, b) => b.revenue - a.revenue),
    byPaymentMethod: [...group((o) => o.paymentMethod).entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.orders - a.orders),
    byState: [...group((o) => o.shippingAddress.state).entries()].map(([state, v]) => ({ state, ...v })).sort((a, b) => b.orders - a.orders).slice(0, 8),
    topProducts: [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    discounts: [...discountMap.values()],
    customers: { new: newC, returning: emails.size - newC },
  };
}

function paymentSessionFor(db: MockDb, o: Order) {
  void db;
  return {
    provider: o.paymentMethod,
    status: o.paymentStatus,
    reference: o.number,
    // No hosted checkout exists in mock mode, so there is nowhere to redirect.
    redirectUrl: null,
    bankTransfer: o.bankTransfer,
  };
}

function saveProduct(db: MockDb, existing: Product | null, body: Contract["adminCreateProduct"]["body"]): Product {
  const fields: Record<string, string> = {};
  if (!body.title.trim()) fields.title = "Enter a product name.";
  if (!body.variants.length) fields.variants = "Add at least one variant.";
  body.variants.forEach((v, i) => {
    if (!Number.isInteger(v.price) || v.price <= 0) fields[`variants.${i}.price`] = "Enter a price above ₦0.";
    if (!v.sku.trim()) fields[`variants.${i}.sku`] = "Enter a SKU.";
  });
  const skus = body.variants.map((v) => v.sku.trim());
  if (new Set(skus).size !== skus.length) fields.variants = "Each variant needs a unique SKU.";
  const handle = slugify(body.handle || body.title);
  if (db.products.some((p) => p.handle === handle && p.id !== existing?.id)) fields.handle = "Another product already uses this URL.";
  if (body.video?.url.trim() && !/^https:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(body.video.url.trim())) fields.video = "Use a direct https link to an .mp4 or .webm file.";
  if (body.productTypeId && !db.productTypes.some((t) => t.id === body.productTypeId)) fields.productTypeId = "Choose a product type that exists.";
  if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);

  const id = existing?.id ?? newId("prod");
  const product: Product = {
    id,
    handle,
    title: body.title.trim(),
    subtitle: body.subtitle,
    description: body.description,
    status: body.status,
    collectionIds: body.collectionIds,
    media: mediaFor(db, body.mediaIds),
    options: body.options.filter((o) => o.name.trim() && o.values.length),
    variants: body.variants.map((v, i) => ({
      id: v.id ?? newId("var"),
      productId: id,
      sku: v.sku.trim(),
      title: v.title || Object.values(v.options).join(" / ") || "Default",
      options: v.options,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      availability: "in_stock",
      // Stock on existing variants only changes through inventory adjustments (audited).
      inventory: { ...v.inventory, available: existing?.variants.find((x) => x.id === v.id)?.inventory.available ?? Math.max(0, Math.trunc(v.inventory.available)) },
      mediaId: v.mediaId,
      position: i,
    })),
    priceRange: { min: 0, max: 0 },
    compareAtPriceRange: null,
    availability: "in_stock",
    productTypeId: body.productTypeId,
    attributes: Object.fromEntries(Object.entries(body.attributes).filter(([, v]) => v.trim())),
    video: body.video?.url.trim() ? { url: body.video.url.trim(), poster: body.video.posterId ? db.media.find((m) => m.id === body.video!.posterId) ?? null : null } : null,
    tags: body.tags,
    rating: existing?.rating ?? { average: 0, count: 0 },
    featured: body.featured,
    seo: body.seo,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  refreshProduct(product);
  if (existing) db.products = db.products.map((p) => (p.id === id ? product : p));
  else db.products.unshift(product);
  refreshAll(db);
  return product;
}

function validateDiscount(db: MockDb, body: Contract["adminCreateDiscount"]["body"], existing: Discount | null): Discount {
  const code = body.code.trim().toUpperCase();
  const fields: Record<string, string> = {};
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) fields.code = "Use 3 to 24 letters, numbers, dashes or underscores.";
  if (db.discounts.some((d) => d.code === code && d.id !== existing?.id)) fields.code = "Another discount uses this code.";
  if (body.kind === "percentage" && (body.value <= 0 || body.value > 100)) fields.value = "Enter a percentage between 1 and 100.";
  if (body.kind === "fixed_amount" && body.value <= 0) fields.value = "Enter an amount above ₦0.";
  if (body.endsAt && Date.parse(body.endsAt) <= Date.parse(body.startsAt)) fields.endsAt = "End date must be after the start date.";
  if (Object.keys(fields).length) fail(422, "validation_failed", "Check the highlighted fields.", fields);
  return { ...body, code, id: existing?.id ?? newId("disc"), usageCount: existing?.usageCount ?? 0, status: body.status };
}

/** Direct, in-process call used by server components in mock mode. */
export function callMock<K extends EndpointName>(name: K, req: RequestOf<K>, ctx?: MockContext): ResponseOf<K> {
  const db = getDb();
  refreshAll(db);
  const noCookies: MockContext = { getCookie: () => undefined, setCookie: () => {}, clearCookie: () => {} };
  const handler = handlers[name] as Handler<K>;
  return structuredClone(handler(req, ctx ?? noCookies, db));
}
