/**
 * Shallow response-shape checks for the endpoints the UI depends on most.
 *
 * They are deliberately small: they confirm the fields the pages read first, so a backend
 * that answers with a different shape fails with a clear "contract_mismatch" error (and a
 * description of what was wrong) instead of crashing deep inside a component or rendering
 * blank values as if they were real. They never repair or substitute data.
 */
import type { EndpointName } from "./contract";

type Check = (data: unknown) => string | null;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown) => typeof v === "string";
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Returns a problem description, or null when the value has every listed field with the right kind. */
function fields(obj: unknown, spec: Record<string, "string" | "number" | "array" | "object" | "string|null" | "object|null" | "boolean">, where: string): string | null {
  if (!isObj(obj)) return `${where} is not an object`;
  for (const [key, kind] of Object.entries(spec)) {
    const v = obj[key];
    const ok =
      kind === "string" ? isStr(v)
      : kind === "number" ? isNum(v)
      : kind === "boolean" ? typeof v === "boolean"
      : kind === "array" ? Array.isArray(v)
      : kind === "object" ? isObj(v)
      : kind === "string|null" ? v === null || isStr(v)
      : v === null || isObj(v);
    if (!ok) return `${where}.${key} should be ${kind}, got ${v === undefined ? "nothing" : Array.isArray(v) ? "array" : typeof v}`;
  }
  return null;
}

const each = (arr: unknown, check: (item: unknown, where: string) => string | null, where: string): string | null => {
  if (!Array.isArray(arr)) return `${where} is not an array`;
  for (let i = 0; i < Math.min(arr.length, 3); i++) {
    const p = check(arr[i], `${where}[${i}]`);
    if (p) return p;
  }
  return null;
};

const listing = (v: unknown, where: string) =>
  fields(v, { items: "array", page: "number", pageSize: "number", total: "number", totalPages: "number", facets: "array", priceBounds: "object" }, where) ??
  each((v as { items: unknown }).items, (p, w) => fields(p, { id: "string", handle: "string", title: "string", priceRange: "object", availability: "string" }, w), `${where}.items`);

const cart: Check = (v) =>
  fields(v, { id: "string", currency: "string", lines: "array", itemCount: "number", discounts: "array", totals: "object", notices: "array" }, "cart") ??
  fields((v as { totals: unknown }).totals, { subtotal: "number", discountTotal: "number", total: "number" }, "cart.totals");

const collection = (v: unknown, where: string) => fields(v, { id: "string", handle: "string", title: "string", summary: "string", status: "string" }, where);

const REVIEW_STATUSES = ["pending", "approved", "rejected"];
const reviewStatus = (v: unknown, where: string) =>
  REVIEW_STATUSES.includes((v as { status?: unknown })?.status as string) ? null : `${where}.status should be one of ${REVIEW_STATUSES.join(", ")}`;
const review = (v: unknown, where: string) =>
  fields(v, { id: "string", productId: "string", productTitle: "string", author: "string", rating: "number", title: "string", body: "string", verifiedPurchase: "boolean", status: "string", reply: "string|null", createdAt: "string" }, where) ?? reviewStatus(v, where);

export const validators: Partial<Record<EndpointName, Check>> = {
  listProductReviews: (v) =>
    fields(v, { items: "array", page: "number", pageSize: "number", total: "number", totalPages: "number" }, "reviews") ??
    each((v as { items: unknown }).items, review, "reviews.items") ??
    ((v as { summary?: unknown }).summary === undefined
      ? null
      : fields((v as { summary: unknown }).summary, { average: "number", count: "number", distribution: "object" }, "reviews.summary")),
  createProductReview: (v) => fields(v, { id: "string", status: "string", createdAt: "string" }, "reviewSubmission") ?? reviewStatus(v, "reviewSubmission"),
  listCustomerReviews: (v) => each(v, review, "customerReviews"),
  getStoreSettings: (v) =>
    fields(v, { name: "string", tagline: "string", metaDescription: "string", address: "string", currency: "string", branding: "object", theme: "object", productPageNotes: "object", social: "object", announcement: "object", contactEmail: "string|null", phone: "string|null", whatsapp: "string|null", openingHours: "string|null" }, "settings") ??
    fields((v as { branding: unknown }).branding, { colors: "object", radius: "number" }, "settings.branding"),
  getNavigation: (v) => fields(v, { main: "array", footer: "array" }, "navigation"),
  getHomepage: (v) => fields(v, { sections: "array", collections: "array" }, "homepage") ?? each((v as { sections: unknown }).sections, (s, w) => fields(s, { id: "string", type: "string", enabled: "boolean" }, w), "homepage.sections"),
  getPaymentOptions: (v) => fields(v, { methods: "array" }, "paymentOptions") ?? each((v as { methods: unknown }).methods, (m, w) => fields(m, { method: "string", label: "string", description: "string" }, w), "paymentOptions.methods"),
  listCollections: (v) => each(v, collection, "collections"),
  getCollection: (v) => fields(v, { collection: "object", listing: "object" }, "collectionPage") ?? collection((v as { collection: unknown }).collection, "collectionPage.collection") ?? listing((v as { listing: unknown }).listing, "collectionPage.listing"),
  listProducts: (v) => listing(v, "products"),
  getProduct: (v) =>
    fields(v, { product: "object", attributes: "array", collections: "array", related: "array" }, "productDetail") ??
    fields((v as { product: unknown }).product, { id: "string", handle: "string", title: "string", options: "array", variants: "array", media: "array", priceRange: "object", rating: "object" }, "productDetail.product"),
  search: (v) => fields(v, { query: "string", products: "object", collections: "array", suggestions: "array" }, "search") ?? listing((v as { products: unknown }).products, "search.products"),
  createCart: cart,
  getCart: cart,
  addCartLines: cart,
  updateCartLine: cart,
  removeCartLine: cart,
  applyDiscount: cart,
  removeDiscount: cart,
  getShippingRates: (v) => each(v, (q, w) => fields(q, { id: "string", label: "string", amount: "number", etaDays: "array", totals: "object" }, w), "shippingQuotes"),
  placeOrder: (v) =>
    fields(v, { order: "object", payment: "object" }, "checkout") ??
    fields((v as { order: unknown }).order, { number: "string", accessToken: "string", paymentStatus: "string" }, "checkout.order") ??
    fields((v as { payment: unknown }).payment, { redirectUrl: "string|null" }, "checkout.payment"),
  getOrder: (v) => fields(v, { number: "string", paymentStatus: "string", fulfillmentStatus: "string", lines: "array", totals: "object" }, "order"),
  getCustomer: (v) => fields(v, { customer: "object" }, "customerSession"),
  customerLogin: (v) => fields(v, { customer: "object" }, "customerSession"),
  customerRegister: (v) => fields(v, { customer: "object" }, "customerSession"),
  adminSession: (v) => fields(v, { staff: "object", role: "object", permissions: "array" }, "adminSession"),
  adminLogin: (v) => fields(v, { staff: "object", role: "object", permissions: "array" }, "adminSession"),
};

export function validateResponse(name: EndpointName, data: unknown): string | null {
  const check = validators[name];
  return check ? check(data) : null;
}
