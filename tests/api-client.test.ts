/**
 * API client behaviour with a stubbed fetch (no network, no backend).
 * These are frontend unit tests; they do not prove the real API works.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ApiError, buildPath, buildQuery, createApiClient } from "../src/lib/api/client";
import { emitAuthEvent, onAuthEvent } from "../src/lib/api/auth-events";
import { paystackOnly, safePaymentRedirect, shouldRotateIdempotencyKey } from "../src/lib/checkout";
import { safeNext } from "../src/lib/redirect";

type Call = { url: string; init: RequestInit };
const realFetch = globalThis.fetch;
let calls: Call[] = [];

function stub(...responses: (Response | Error | ((init: RequestInit) => Promise<Response>))[]) {
  calls = [];
  let i = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    if (typeof r === "function") return r(init);
    return r.clone();
  }) as typeof fetch;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const goodCart = { id: "c1", currency: "NGN", lines: [], itemCount: 0, discounts: [], totals: { subtotal: 0, discountTotal: 0, shippingTotal: null, taxTotal: 0, total: 0 }, notices: [], updatedAt: "2026-10-28T00:00:00Z" };

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("requests", () => {
  it("builds the URL from the contract, encodes params and drops empty query values", async () => {
    stub(json(200, goodCart));
    const api = createApiClient("https://api.example.test/v1");
    await api.call("getCart", { params: { cartId: "a/b c" } });
    assert.equal(calls[0]!.url, "https://api.example.test/v1/carts/a%2Fb%20c");
    assert.equal(calls[0]!.init.method, "GET");
    assert.equal(calls[0]!.init.credentials, "include", "session cookies are sent to the API");
    assert.equal(buildQuery({ q: "wave", page: 2, empty: "", none: undefined }), "?q=wave&page=2");
    assert.throws(() => buildPath("/orders/:number", {}), /Missing path parameter/);
  });

  it("sends JSON bodies with the contract method", async () => {
    stub(json(200, goodCart));
    await createApiClient("https://x.test").call("applyDiscount", { params: { cartId: "c1" }, body: { code: "WELCOME10" } });
    assert.equal(calls[0]!.init.method, "POST");
    assert.equal(calls[0]!.init.body, JSON.stringify({ code: "WELCOME10" }));
    assert.equal((calls[0]!.init.headers as Record<string, string>)["Content-Type"], "application/json");
  });
});

describe("errors", () => {
  it("turns the backend error envelope into ApiError with fields", async () => {
    stub(json(422, { error: { code: "validation_failed", message: "Check the highlighted fields.", fields: { phone: "Enter a Nigerian mobile number." } } }));
    await assert.rejects(createApiClient("https://x.test").call("placeOrder", { body: {} as never }), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 422);
      assert.equal(e.code, "validation_failed");
      assert.equal(e.fields?.phone, "Enter a Nigerian mobile number.");
      return true;
    });
  });

  it("reports 501 as unavailable, not as success", async () => {
    stub(json(501, { error: { code: "not_implemented", message: "This contract endpoint is not enabled yet" } }));
    await assert.rejects(createApiClient("https://x.test").call("listCustomerOrders"), (e: unknown) => e instanceof ApiError && e.status === 501 && e.isUnavailable);
  });

  it("rejects non-JSON responses", async () => {
    stub(new Response("<html>Bad gateway</html>", { status: 200 }));
    await assert.rejects(createApiClient("https://x.test").call("getCart", { params: { cartId: "c1" } }), (e: unknown) => e instanceof ApiError && e.code === "invalid_response");
  });

  it("rejects a response whose shape doesn't match the contract", async () => {
    stub(json(200, { links: [] }));
    await assert.rejects(createApiClient("https://x.test").call("getNavigation"), (e: unknown) => e instanceof ApiError && e.code === "contract_mismatch" && /main/.test(e.fields?._contract ?? ""));
  });

  it("times out instead of hanging", async () => {
    stub((init) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    await assert.rejects(createApiClient("https://x.test", { timeoutMs: 30, retries: 0 }).call("getCart", { params: { cartId: "c1" } }), (e: unknown) => e instanceof ApiError && e.code === "timeout" && e.status === 0);
  });
});

describe("retries", () => {
  it("retries a GET once after a network error", async () => {
    stub(new TypeError("fetch failed"), json(200, goodCart));
    const cart = await createApiClient("https://x.test").call("getCart", { params: { cartId: "c1" } });
    assert.equal(cart.id, "c1");
    assert.equal(calls.length, 2);
  });

  it("never retries a mutation automatically", async () => {
    stub(new TypeError("fetch failed"), json(200, {}));
    await assert.rejects(createApiClient("https://x.test").call("placeOrder", { body: {} as never }), (e: unknown) => e instanceof ApiError && e.code === "network_error");
    assert.equal(calls.length, 1, "a checkout is sent once; the idempotency key covers manual retries");
  });

  it("does not retry 4xx", async () => {
    stub(json(404, { error: { code: "cart_not_found", message: "Cart not found." } }), json(200, goodCart));
    await assert.rejects(createApiClient("https://x.test").call("getCart", { params: { cartId: "gone" } }), (e: unknown) => e instanceof ApiError && e.isNotFound);
    assert.equal(calls.length, 1);
  });
});

describe("authentication", () => {
  it("reports 401 and 403 from authenticated endpoints with their scope", async () => {
    const seen: string[] = [];
    stub(json(401, { error: { code: "unauthorized", message: "Sign in again." } }));
    const api = createApiClient("https://x.test", { onAuthError: (e) => seen.push(`${e.scope}:${e.status}:${e.endpoint}`) });
    await assert.rejects(api.call("adminListOrders", { query: {} }));
    stub(json(403, { error: { code: "forbidden", message: "Not allowed." } }));
    await assert.rejects(api.call("listAddresses"));
    assert.deepEqual(seen, ["admin:401:adminListOrders", "customer:403:listAddresses"]);
  });

  it("does not treat a failed public login as an expired session", async () => {
    const seen: unknown[] = [];
    stub(json(401, { error: { code: "invalid_credentials", message: "Email or password is wrong." } }));
    await assert.rejects(createApiClient("https://x.test", { onAuthError: (e) => seen.push(e) }).call("adminLogin", { body: { email: "a@b.c", password: "x" } }));
    assert.equal(seen.length, 0);
  });

  it("broadcasts auth events to listeners", () => {
    const got: string[] = [];
    const off = onAuthEvent((e) => got.push(e.scope));
    emitAuthEvent({ status: 401, scope: "admin", endpoint: "adminDashboard" });
    off();
    emitAuthEvent({ status: 401, scope: "admin", endpoint: "adminDashboard" });
    assert.deepEqual(got, ["admin"]);
  });

  it("only allows same-site post-login redirects", () => {
    assert.equal(safeNext("/admin/orders?status=open", "/admin", "/admin"), "/admin/orders?status=open");
    assert.equal(safeNext("%2Fadmin%2Fproducts", "/admin", "/admin"), "/admin/products");
    for (const bad of ["https://evil.test/admin", "//evil.test", "/\\evil.test", "/admin-evil", "/javascript:alert(1)", "/admin/login?next=/admin", null, "%E0%A4%A"]) {
      assert.equal(safeNext(bad, "/admin", "/admin"), "/admin", String(bad));
    }
    assert.equal(safeNext("/checkout", "/", ""), "/checkout");
    assert.equal(safeNext("//evil.test/checkout", "/", ""), "");
  });
});

describe("checkout safety", () => {
  it("only follows https payment redirects", () => {
    assert.equal(safePaymentRedirect("https://checkout.paystack.com/abc"), "https://checkout.paystack.com/abc");
    assert.equal(safePaymentRedirect("http://checkout.paystack.com/abc"), null);
    assert.equal(safePaymentRedirect("javascript:alert(1)"), null);
    assert.equal(safePaymentRedirect(null), null);
    assert.equal(safePaymentRedirect("https://evil.example/paystack.com"), null, "only Paystack's own host");
    assert.equal(safePaymentRedirect("https://checkout.paystack.com.evil.example/x"), null);
    assert.equal(safePaymentRedirect("https://user:pw@checkout.paystack.com/x"), null);
    assert.equal(safePaymentRedirect("https://checkout.flutterwave.com/x"), null, "Paystack is the only provider");
  });

  it("offers Paystack as the only way to pay at checkout", () => {
    const all = {
      methods: [
        { method: "bank_transfer" as const, label: "Bank transfer", description: "" },
        { method: "paystack" as const, label: "Paystack", description: "" },
        { method: "pay_on_delivery" as const, label: "Pay on delivery", description: "" },
      ],
    };
    const r = paystackOnly(all);
    assert.equal(r.methods.length, 1);
    assert.equal(r.methods[0]!.method, "paystack");
    assert.deepEqual(paystackOnly({ methods: [{ method: "flutterwave", label: "F", description: "" }] }).methods, []);
    assert.deepEqual(paystackOnly({ methods: [] }).methods, []);
  });

  it("keeps the idempotency key for retryable failures and replaces it after a definite rejection", () => {
    assert.equal(shouldRotateIdempotencyKey(new ApiError(0, "network_error", "x")), false, "the order may exist: retry with the same key");
    assert.equal(shouldRotateIdempotencyKey(new ApiError(502, "http_error", "x")), false);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(429, "rate_limited", "x")), false);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(409, "cart_changed", "x")), true);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(422, "validation_failed", "x")), true);
  });
});

describe("review response checks", () => {
  // Imported lazily so the module list at the top stays focused on the client.
  const load = () => import("../src/lib/api/validate");
  const review = { id: "r1", productId: "p1", productTitle: "Wig", author: "A", rating: 5, title: "", body: "Lovely hair", verifiedPurchase: false, status: "approved", reply: null, rejectionReason: null, createdAt: "2026-10-01T00:00:00Z", moderatedAt: null };

  it("accepts a review page with or without a summary", async () => {
    const { validateResponse } = await load();
    const page = { items: [review], page: 1, pageSize: 6, total: 1, totalPages: 1 };
    assert.equal(validateResponse("listProductReviews", page), null);
    assert.equal(validateResponse("listProductReviews", { ...page, summary: { average: 5, count: 1, distribution: { "5": 1 } } }), null);
  });

  it("refuses review statuses the storefront can't explain to customers", async () => {
    const { validateResponse } = await load();
    assert.match(validateResponse("createProductReview", { id: "r1", status: "published", createdAt: "2026-10-01T00:00:00Z" }) ?? "", /status/);
    assert.match(validateResponse("listCustomerReviews", [{ ...review, status: "hidden" }]) ?? "", /status/);
    assert.equal(validateResponse("createProductReview", { id: "r1", status: "pending", createdAt: "2026-10-01T00:00:00Z" }), null);
  });
});

describe("settings adapter", () => {
  it("maps the production settings format onto the contract without inventing contact details", async () => {
    const { normalizeSettings } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    // Exact response from GET https://api.queenluxuryhair.store/v1/store/settings on 29 Oct 2026.
    const prod = { name: "Queen Luxury Hair", address: "Ijoka, beside Ibiyemi Building Material, Ilesha, Osun State, Nigeria", currency: "NGN", timezone: "Africa/Lagos", phone: null, whatsapp: null, email: null, hours: [], socials: {} };
    assert.match(validateResponse("getStoreSettings", prod) ?? "", /tagline/);
    const s = normalizeSettings(prod) as Record<string, unknown>;
    assert.equal(validateResponse("getStoreSettings", s), null);
    assert.equal(s.name, "Queen Luxury Hair");
    assert.equal(s.address, prod.address);
    assert.equal(s.contactEmail, null);
    assert.equal(s.phone, null);
    assert.equal(s.whatsapp, null);
    assert.equal(s.openingHours, null);
    assert.deepEqual(s.social, { instagram: null, tiktok: null, facebook: null });
  });

  it("leaves contract-shaped settings values intact", async () => {
    const { normalizeSettings } = await import("../src/lib/api/normalize");
    const s = normalizeSettings({ name: "X", tagline: "T", contactEmail: "a@b.co", hours: ["Mon–Sat 9 to 6"], socials: { instagram: "https://instagram.com/x" } }) as Record<string, unknown>;
    assert.equal(s.tagline, "T");
    assert.equal(s.contactEmail, "a@b.co");
    assert.equal(s.openingHours, "Mon–Sat 9 to 6");
    assert.deepEqual(s.social, { instagram: "https://instagram.com/x", tiktok: null, facebook: null });
  });
});

describe("auth error and session parsing", () => {
  it("classifies a non-JSON 401 by status, not as a malformed response", async () => {
    stub(new Response("Unauthorized", { status: 401, headers: { "content-type": "text/plain" } }));
    await assert.rejects(createApiClient("https://x.test").call("adminLogin", { body: { email: "a@b.co", password: "x" } }), (e: unknown) => e instanceof ApiError && e.status === 401 && e.code === "unauthenticated");
  });

  it("reads Fastify's default error format", async () => {
    stub(json(401, { statusCode: 401, error: "Unauthorized", message: "Invalid credentials" }));
    await assert.rejects(createApiClient("https://x.test").call("adminLogin", { body: { email: "a@b.co", password: "x" } }), (e: unknown) => e instanceof ApiError && e.status === 401 && e.message === "Invalid credentials");
  });

  it("adapts a user-shaped owner session and keeps backend permissions when given", async () => {
    const { normalizeAdminSession } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    const owner = normalizeAdminSession({ user: { id: 1, email: "owner@x.co", firstName: "Ada", lastName: "O", role: "owner" } }) as { permissions: string[]; staff: { name: string } };
    assert.equal(validateResponse("adminSession", owner), null);
    assert.equal(owner.staff.name, "Ada O");
    assert.ok(owner.permissions.includes("products:write"));
    const limited = normalizeAdminSession({ session: { user: { id: "s1", email: "f@x.co", role: { id: "r2", name: "Fulfilment", permissions: ["orders:read", "made:up"] } } } }) as { permissions: string[] };
    assert.deepEqual(limited.permissions, ["orders:read"]);
  });

  it("does not invent permissions for a non-owner role without any", async () => {
    const { normalizeAdminSession } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    const raw = { user: { id: 2, email: "m@x.co", role: "manager" } };
    assert.notEqual(validateResponse("adminSession", normalizeAdminSession(raw)), null);
  });
});

describe("cart adapter", () => {
  it("maps the production cart (flat totals) onto the contract", async () => {
    const { normalizeCart } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    // Exact POST /v1/carts response, 29 Oct 2026.
    const prod = { id: "bcb80f46", lines: [], subtotal: 0, discountTotal: 0, shippingTotal: 0, total: 0, currency: "NGN" };
    assert.match(validateResponse("createCart", prod) ?? "", /itemCount|discounts|totals/);
    const c = normalizeCart(prod) as { itemCount: number; totals: { total: number } };
    assert.equal(validateResponse("createCart", c), null);
    assert.equal(c.itemCount, 0);
    assert.equal(c.totals.total, 0);
    const withLines = normalizeCart({ ...prod, lines: [{ quantity: 2 }, { quantity: 1 }], subtotal: 30000, total: 30000 }) as { itemCount: number; totals: { subtotal: number } };
    assert.equal(withLines.itemCount, 3);
    assert.equal(withLines.totals.subtotal, 30000);
  });
});

describe("admin response checks", () => {
  it("rejects a dashboard without the arrays the page renders, instead of letting it crash", async () => {
    const { validateResponse } = await import("../src/lib/api/validate");
    assert.match(validateResponse("adminDashboard", { revenue: 0, orders: 0 }) ?? "", /dashboard\./);
    const ok = { periodDays: 30, revenue: 0, revenueChangePct: null, orders: 0, averageOrderValue: 0, awaitingPayment: 0, awaitingFulfillment: 0, newInquiries: 0, pendingReviews: 0, revenueSeries: [], lowStock: [], recentOrders: [], topProducts: [] };
    assert.equal(validateResponse("adminDashboard", ok), null);
    assert.match(validateResponse("adminListProducts", []) ?? "", /products/);
  });
});

describe("admin permissions from the backend", () => {
  it("reads permissions from the role even when the top-level list is empty", async () => {
    const { normalizeAdminSession } = await import("../src/lib/api/normalize");
    const s = normalizeAdminSession({ user: { id: 1, email: "o@x.co" }, permissions: [], role: { id: "owner", name: "Owner", permissions: ["dashboard:read", "products:write"] } }) as { permissions: string[] };
    assert.deepEqual(s.permissions, ["dashboard:read", "products:write"]);
  });

  it("canonicalises spelling and explicit wildcards without widening other grants", async () => {
    const { canonicalPermissions } = await import("../src/lib/api/normalize");
    const { PERMISSIONS } = await import("../src/lib/types");
    assert.deepEqual(canonicalPermissions(["DASHBOARD_READ", "orders.read", "read:analytics"]), ["dashboard:read", "orders:read", "analytics:read"]);
    assert.deepEqual(canonicalPermissions(["*"]), [...PERMISSIONS]);
    assert.deepEqual(canonicalPermissions(["products:*"]), ["products:read", "products:write"]);
    assert.deepEqual(canonicalPermissions(["made:up", "dashboard"]), []);
  });

  it("keeps an explicitly empty owner list empty (the backend decides), and limited roles limited", async () => {
    const { normalizeAdminSession } = await import("../src/lib/api/normalize");
    const owner = normalizeAdminSession({ user: { id: 1, email: "o@x.co", role: "owner" }, permissions: [] }) as { permissions: string[]; receivedPermissions: string[] };
    assert.deepEqual(owner.permissions, []);
    assert.deepEqual(owner.receivedPermissions, []);
    const fulfil = normalizeAdminSession({ staff: { id: "s", name: "F", email: "f@x.co", roleId: "r" }, role: { id: "r", name: "Fulfilment", permissions: ["orders:read", "orders:write"] }, permissions: ["orders:read", "orders:write"] }) as { permissions: string[] };
    assert.deepEqual(fulfil.permissions, ["orders:read", "orders:write"]);
  });
});

describe("production backend compatibility", () => {
  it("makes a valid handle from the title when the handle is empty", async () => {
    const { handleFor, slugify } = await import("../src/lib/slug");
    assert.equal(handleFor("", "Bone Straight 26\" — Double Drawn"), "bone-straight-26-double-drawn");
    assert.equal(handleFor("  My-Handle ", "ignored"), "my-handle");
    assert.match(slugify("Crème brûlée wig"), /^[a-z0-9-]+$/);
  });

  it("maps per-product inventory rows onto the inventory screen's format", async () => {
    const { normalizeInventoryList } = await import("../src/lib/api/normalize");
    const rows = normalizeInventoryList([{ productId: "p1", handle: "h", title: "Wig", sku: "S1", available: 3 }]) as Array<Record<string, unknown>>;
    assert.equal(rows[0]!.productTitle, "Wig");
    assert.equal(rows[0]!.variantId, "p1");
    assert.equal(rows[0]!.availability, "low_stock");
  });
});

describe("product cards from the production API", () => {
  // Shape of GET /v1/products items on 30 Oct 2026 (full products, not cards).
  const product = { id: "p1", handle: "futura-wigs", title: "Futura Wigs", subtitle: "", description: "", status: "published", collectionIds: [], media: [{ id: "m1", url: "https://api.queenluxuryhair.store/v1/media/m1", alt: "Wig", width: 800, height: 1000, mimeType: "image/webp", tags: [], createdAt: "2026-10-30T00:00:00Z" }], options: [], variants: [{ id: "v1" }], priceRange: { min: 5000000, max: 5000000 }, compareAtPriceRange: { min: 6000000, max: 6000000 }, availability: "in_stock", productTypeId: null, attributes: {}, video: null, tags: [], rating: { average: 0, count: 0 }, featured: false, seo: {}, createdAt: "", updatedAt: "" };

  it("turns listing products into cards the grid can render", async () => {
    const { normalizeResponse } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    const raw = { items: [product], page: 1, pageSize: 8, total: 1, totalPages: 1, facets: [], priceBounds: { min: 0, max: 0 } };
    assert.match(validateResponse("listProducts", raw) ?? "", /badges/);
    const listing = normalizeResponse("listProducts", raw) as { items: Array<{ image: { id: string } | null; badges: string[]; hoverImage: unknown }> };
    assert.equal(validateResponse("listProducts", listing), null);
    assert.equal(listing.items[0]!.image?.id, "m1");
    assert.equal(listing.items[0]!.hoverImage, null);
    assert.deepEqual(listing.items[0]!.badges, ["Sale"]);
  });

  it("marks sold-out products and adapts search and collection listings too", async () => {
    const { normalizeResponse } = await import("../src/lib/api/normalize");
    const sold = { ...product, availability: "out_of_stock", compareAtPriceRange: null };
    const search = normalizeResponse("search", { query: "w", products: { items: [sold], page: 1, pageSize: 1, total: 1, totalPages: 1, facets: [], priceBounds: { min: 0, max: 0 } }, collections: [], suggestions: [] }) as { products: { items: Array<{ badges: string[] }> } };
    assert.deepEqual(search.products.items[0]!.badges, ["Sold out"]);
    const col = normalizeResponse("getCollection", { collection: {}, listing: { items: [product], page: 1, pageSize: 1, total: 1, totalPages: 1, facets: [], priceBounds: { min: 0, max: 0 } } }) as { listing: { items: Array<{ badges: unknown }> } };
    assert.ok(Array.isArray(col.listing.items[0]!.badges));
  });
});

describe("hardening against unsafe API content", () => {
  it("only allows safe link targets from menus, homepage and the announcement", async () => {
    const { safeHref, normalizeResponse, normalizeSettings } = await import("../src/lib/api/normalize");
    for (const ok of ["/collections", "/collections?x=1", "#faq", "https://wa.me/234", "mailto:a@b.co", "tel:+234"]) assert.equal(safeHref(ok), ok);
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.example", "/\\\\evil.example", "vbscript:x"]) assert.equal(safeHref(bad), "/");
    const nav = normalizeResponse("getNavigation", { main: [{ id: "1", label: "x", href: "javascript:alert(1)", children: [{ id: "2", label: "y", href: "/ok" }] }], footer: [] }) as { main: Array<{ href: string; children: Array<{ href: string }> }> };
    assert.equal(nav.main[0]!.href, "/");
    assert.equal(nav.main[0]!.children[0]!.href, "/ok");
    const s = normalizeSettings({ name: "Q", announcement: { enabled: true, message: "Hi", href: "javascript:alert(1)" } }) as { announcement: { href: string } };
    assert.equal(s.announcement.href, "/");
  });

  it("never writes an unknown theme value into the inline theme script", async () => {
    const { themeScript } = await import("../src/lib/theme");
    const out = themeScript('"</script><script>alert(1)</script>' as never);
    assert.ok(!out.includes("</script>"));
    assert.ok(out.includes('"system"'));
  });
});

describe("admin adapters for the production API", () => {
  it("unwraps the paged reviews list and the moderated review", async () => {
    const { normalizeResponse } = await import("../src/lib/api/normalize");
    const { validateResponse } = await import("../src/lib/api/validate");
    const r = { id: "r1", productId: "p1", productTitle: "Wig", author: "A", rating: 5, title: "", body: "Lovely hair", verifiedPurchase: false, status: "pending", reply: null, rejectionReason: null, createdAt: "2026-10-30T00:00:00Z", moderatedAt: null };
    const list = normalizeResponse("adminListReviews", { items: [r], page: 1, pageSize: 1, total: 1, totalPages: 1 });
    assert.ok(Array.isArray(list));
    assert.equal(validateResponse("adminListReviews", list), null);
    assert.equal((normalizeResponse("adminModerateReview", { review: { ...r, status: "approved" } }) as { status: string }).status, "approved");
  });

  it("maps { order } with items into an order the detail page can show, without inventing details", async () => {
    const { normalizeAdminOrder } = await import("../src/lib/api/normalize");
    const o = normalizeAdminOrder({ order: { id: "o1", number: "QLH-1", status: "open", paymentStatus: "paid", fulfillmentStatus: "unfulfilled", paymentMethod: "pay_on_delivery", email: "c@x.co", totals: { subtotal: 100, discountTotal: 0, shippingTotal: 0, total: 100, currency: "NGN" }, items: [{ productId: "p1", title: "Wig", quantity: 2, unitPrice: 50 }], itemCount: 2, createdAt: "" } }) as { lines: Array<{ lineTotal: number; title: string }>; contact: { email: string; phone: string }; shippingAddress: { line1: string }; timeline: unknown[] };
    assert.equal(o.lines[0]!.lineTotal, 100);
    assert.equal(o.contact.email, "c@x.co");
    assert.equal(o.contact.phone, "");
    assert.equal(o.shippingAddress.line1, "");
    assert.deepEqual(o.timeline, []);
  });

  it("renames dashboard low-stock fields", async () => {
    const { normalizeResponse } = await import("../src/lib/api/normalize");
    const d = normalizeResponse("adminDashboard", { lowStock: [{ variant_id: "v", product_id: "p", product_title: "Wig", variant_title: "Default", sku: "S", available: "2" }] }) as { lowStock: Array<{ productTitle: string; available: number }> };
    assert.equal(d.lowStock[0]!.productTitle, "Wig");
    assert.equal(d.lowStock[0]!.available, 2);
  });
});

describe("Paystack public key check", () => {
  it("accepts the right public key for the chosen mode and refuses secret keys", async () => {
    const { paystackKeyProblem } = await import("../src/lib/paystack");
    assert.equal(paystackKeyProblem("pk_live_abc123", "live", true), null);
    assert.equal(paystackKeyProblem("pk_test_abc123", "test", true), null);
    assert.equal(paystackKeyProblem("", "test", false), null, "nothing to check while switched off");
    assert.match(paystackKeyProblem("sk_live_abc123", "live", true)!, /SECRET key/);
    assert.match(paystackKeyProblem("sk_test_abc", "test", false)!, /SECRET key/, "secret keys are refused even when switched off");
    assert.match(paystackKeyProblem("pk_test_abc", "live", true)!, /test key/);
    assert.match(paystackKeyProblem("pk_live_abc", "test", true)!, /live key/);
    assert.match(paystackKeyProblem("hello", "live", true)!, /doesn't look like/);
    assert.match(paystackKeyProblem("", "live", true)!, /Paste/);
  });
});

describe("line item size names", () => {
  it("hides 'Default' and a size name that just repeats the product name", async () => {
    const { variantLabel } = await import("../src/lib/format");
    assert.equal(variantLabel({ productTitle: "Futura Wigs", variantTitle: "Futura Wigs" }), "");
    assert.equal(variantLabel({ productTitle: "Futura Wigs", variantTitle: "Default" }), "");
    assert.equal(variantLabel({ title: "Futura Wigs", variantTitle: "" }), "");
    assert.equal(variantLabel({ productTitle: "Futura Body Wave", variantTitle: "18\" / 1B" }), "18\" / 1B");
  });
});
