/**
 * Behaviour tests for the mock backend: the same rules the Fastify backend must follow.
 * Run with `npm test`.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { callMock, MockHttpError, type MockContext } from "../src/lib/mock/backend";
import { resetDb } from "../src/lib/mock/db";
import type { ProductInput } from "../src/lib/types";

function session(): MockContext {
  const jar = new Map<string, string>();
  return {
    getCookie: (n) => jar.get(n),
    setCookie: (n, v, maxAge) => (maxAge > 0 ? jar.set(n, v) : jar.delete(n)),
    clearCookie: (n) => jar.delete(n),
  };
}

function expectError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof MockHttpError, `expected MockHttpError, got ${String(err)}`);
    assert.equal(err.status, status, err.message);
    return err;
  }
  assert.fail(`expected HTTP ${status}`);
}

function signInOwner() {
  const ctx = session();
  callMock("adminLogin", { body: { email: "owner@queenpalace.test", password: "demo-owner" } }, ctx);
  return ctx;
}

const firstInStock = (handle: string) => {
  const { product } = callMock("getProduct", { params: { handle } });
  const v = product.variants.find((x) => x.availability !== "out_of_stock" && x.inventory.available >= 2);
  assert.ok(v, `no in-stock variant for ${handle}`);
  return v!;
};

beforeEach(() => {
  resetDb();
});

describe("catalog", () => {
  it("seeds the five initial collections as data, in admin order", () => {
    const cols = callMock("listCollections", {});
    assert.deepEqual(
      cols.map((c) => c.title),
      ["Futura Wig", "Bone Straight", "Factory Wigs", "Braids Extensions", "Hair Maintains"],
    );
  });

  it("shows product attributes from the product type, with labels", () => {
    const wig = callMock("getProduct", { params: { handle: "bone-straight-double-drawn" } });
    assert.equal(wig.productType?.name, "Wig");
    assert.ok(wig.attributes.some((a) => a.label === "Lace" && a.value.includes("13x4")));
    const care = callMock("getProduct", { params: { handle: "care-edge-control" } });
    assert.equal(care.productType?.name, "Hair care");
    assert.ok(care.attributes.some((a) => a.group === "usage"));
    assert.ok(!care.attributes.some((a) => a.label === "Lace"), "hair care must not show wig fields");
  });

  it("computes ratings only from published reviews", () => {
    const { product } = callMock("getProduct", { params: { handle: "futura-body-wave" } });
    const reviews = callMock("listProductReviews", { params: { productId: product.id }, query: {} });
    assert.equal(product.rating.count, reviews.total);
  });

  it("searches within a collection", () => {
    const res = callMock("getCollection", { params: { handle: "futura-wig" }, query: { q: "bob" } });
    assert.ok(res.listing.items.length >= 1);
    assert.ok(res.listing.items.every((p) => /bob/i.test(`${p.title} ${p.subtitle}`)));
  });
});

describe("cart and checkout", () => {
  it("prices lines from backend data and applies discounts", () => {
    const v = firstInStock("bone-straight-double-drawn");
    let cart = callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: 2 }] } });
    assert.equal(cart.totals.subtotal, v.price * 2);
    assert.equal(cart.totals.total, v.price * 2);
    cart = callMock("applyDiscount", { params: { cartId: cart.id }, body: { code: "welcome10" } });
    assert.equal(cart.totals.discountTotal, Math.round((v.price * 2 * 10) / 100));
    assert.equal(cart.totals.total, cart.totals.subtotal - cart.totals.discountTotal);
  });

  it("refuses more than the available stock", () => {
    const v = firstInStock("futura-body-wave");
    expectError(() => callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: v.inventory.available + 1 }] } }), 409);
  });

  it("rejects unknown and expired discount codes", () => {
    const v = firstInStock("futura-body-wave");
    const cart = callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: 1 }] } });
    expectError(() => callMock("applyDiscount", { params: { cartId: cart.id }, body: { code: "NOPE" } }), 422);
    expectError(() => callMock("applyDiscount", { params: { cartId: cart.id }, body: { code: "FREESHIP" } }), 422);
  });

  it("quotes Ilesha delivery and pickup, and other zones by state", () => {
    const v = firstInStock("care-silk-bonnet");
    const cart = callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: 1 }] } });
    const ilesha = callMock("getShippingRates", { body: { cartId: cart.id, address: { state: "Osun", city: "Ilesha" } } });
    assert.deepEqual(ilesha.map((r) => r.id), ["rate_ilesha_rider", "rate_ilesha_pickup"]);
    const osogbo = callMock("getShippingRates", { body: { cartId: cart.id, address: { state: "Osun", city: "Osogbo" } } });
    assert.deepEqual(osogbo.map((r) => r.id), ["rate_osun_std"]);
    const kano = callMock("getShippingRates", { body: { cartId: cart.id, address: { state: "Kano", city: "Kano" } } });
    assert.deepEqual(kano.map((r) => r.id), ["rate_ng_std"]);
    for (const q of [...ilesha, ...kano]) assert.equal(q.totals.total, cart.totals.subtotal + q.amount);
  });

  it("places a pay-on-delivery order as pending, reserves stock, and is idempotent", () => {
    const v = firstInStock("care-silk-bonnet");
    const before = v.inventory.available;
    const cart = callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: 1 }] } });
    const [rate] = callMock("getShippingRates", { body: { cartId: cart.id, address: { state: "Osun", city: "Ilesha" } } });
    const body = {
      cartId: cart.id,
      contact: { email: "test@example.com", phone: "08030000000", marketingOptIn: false },
      shippingAddress: { firstName: "Ada", lastName: "Test", phone: "08030000000", line1: "1 Test Street", city: "Ilesha", state: "Osun", country: "NG" as const },
      shippingRateId: rate!.id,
      paymentMethod: "pay_on_delivery" as const,
      idempotencyKey: "test-key-1",
    };
    const res = callMock("placeOrder", { body });
    assert.equal(res.order.paymentStatus, "pending");
    assert.equal(res.payment.redirectUrl, null);
    assert.equal(res.order.totals.total, rate!.totals.total);
    const again = callMock("placeOrder", { body });
    assert.equal(again.order.number, res.order.number);
    const after = callMock("getProduct", { params: { handle: "care-silk-bonnet" } }).product.variants.find((x) => x.id === v.id)!;
    assert.equal(after.inventory.available, before - 1);
    expectError(() => callMock("getOrder", { params: { number: res.order.number }, query: { token: "wrong" } }), 404);
  });

  it("does not offer pay on delivery outside its states", () => {
    const v = firstInStock("care-silk-bonnet");
    const cart = callMock("createCart", { body: { lines: [{ variantId: v.id, quantity: 1 }] } });
    const [rate] = callMock("getShippingRates", { body: { cartId: cart.id, address: { state: "Kano", city: "Kano" } } });
    expectError(
      () =>
        callMock("placeOrder", {
          body: {
            cartId: cart.id,
            contact: { email: "test@example.com", phone: "08030000000", marketingOptIn: false },
            shippingAddress: { firstName: "Ada", lastName: "Test", phone: "08030000000", line1: "1 Test Street", city: "Kano", state: "Kano", country: "NG" },
            shippingRateId: rate!.id,
            paymentMethod: "pay_on_delivery",
            idempotencyKey: "test-key-2",
          },
        }),
      422,
    );
  });
});

describe("admin catalog management", () => {
  it("creates a hair-care product with its own fields", () => {
    const ctx = signInOwner();
    const input: ProductInput = {
      title: "Scalp Soothing Oil",
      handle: "",
      subtitle: "Lightweight oil for braids",
      description: "Calms itchy scalps under braids.",
      status: "published",
      featured: false,
      collectionIds: ["col_maintains"],
      mediaIds: [],
      video: null,
      options: [{ name: "Size", values: ["100ml"] }],
      variants: [{ sku: "QP-SSO-100", title: "100ml", options: { Size: "100ml" }, price: 450000, compareAtPrice: null, mediaId: null, position: 0, inventory: { tracked: true, policy: "deny", lowStockThreshold: 2, available: 12 } }],
      productTypeId: "type_care",
      attributes: { volume: "100ml", usage: "Part your braids.\nApply a few drops to the scalp." },
      tags: ["care"],
      seo: {},
    };
    const created = callMock("adminCreateProduct", { body: input }, ctx);
    assert.equal(created.handle, "scalp-soothing-oil");
    const detail = callMock("getProduct", { params: { handle: created.handle } });
    assert.ok(detail.attributes.some((a) => a.label === "How to use"));
    const listing = callMock("getCollection", { params: { handle: "hair-maintains" }, query: { pageSize: 48 } });
    assert.ok(listing.listing.items.some((p) => p.id === created.id));
  });

  it("duplicates a product as a draft with unique URL and SKUs and no stock", () => {
    const ctx = signInOwner();
    const { product } = callMock("getProduct", { params: { handle: "futura-body-wave" } });
    const copy = callMock("adminDuplicateProduct", { params: { id: product.id } }, ctx);
    assert.equal(copy.status, "draft");
    assert.notEqual(copy.handle, product.handle);
    assert.ok(copy.variants.every((v) => v.inventory.available === 0 && v.sku.endsWith("-COPY")));
    expectError(() => callMock("getProduct", { params: { handle: copy.handle } }), 404);
  });

  it("deleting a collection keeps its products and reports any left unassigned", () => {
    const ctx = signInOwner();
    const before = callMock("adminListProducts", { query: { collectionId: "col_braids", pageSize: 50 } }, ctx);
    const res = callMock("adminDeleteCollection", { params: { id: "col_braids" } }, ctx);
    assert.equal(res.unassignedProductIds.length, before.total);
    const unassigned = callMock("adminListProducts", { query: { collectionId: "none", pageSize: 50 } }, ctx);
    assert.equal(unassigned.total, before.total);
    expectError(() => callMock("getCollection", { params: { handle: "braids-extensions" }, query: {} }), 404);
  });

  it("creates, reorders and hides collections", () => {
    const ctx = signInOwner();
    const c = callMock("adminCreateCollection", { body: { title: "Closures & Frontals", handle: "", summary: "", description: "", status: "draft", imageId: null, bannerId: null, seo: {}, position: 0 } }, ctx);
    assert.equal(c.handle, "closures-frontals");
    assert.ok(!callMock("listCollections", {}).some((x) => x.id === c.id), "drafts are hidden");
    callMock("adminUpdateCollection", { params: { id: c.id }, body: { status: "published" } }, ctx);
    const all = callMock("adminListCollections", {}, ctx);
    callMock("adminReorderCollections", { body: { ids: [c.id, ...all.filter((x) => x.id !== c.id).map((x) => x.id)] } }, ctx);
    assert.equal(callMock("listCollections", {})[0]!.id, c.id);
  });

  it("enforces permissions on the backend", () => {
    const fulfil = session();
    callMock("adminLogin", { body: { email: "fulfilment@queenpalace.test", password: "demo-fulfilment" } }, fulfil);
    expectError(() => callMock("adminGetPaymentSettings", {}, fulfil), 403);
    expectError(() => callMock("adminDuplicateProduct", { params: { id: "prod_1" } }, fulfil), 403);
    expectError(() => callMock("adminAnalytics", { query: {} }, fulfil), 403);
    expectError(() => callMock("adminDashboard", { query: {} }), 401);
  });

  it("will not enable bank transfer without real account details", () => {
    const ctx = signInOwner();
    const pay = callMock("adminGetPaymentSettings", {}, ctx);
    expectError(() => callMock("adminUpdatePaymentSettings", { body: { ...pay, bankTransfer: { ...pay.bankTransfer, enabled: true } } }, ctx), 422);
  });
});

describe("customer accounts", () => {
  it("registers, saves a default address, and signs out", () => {
    const ctx = session();
    const reg = callMock("customerRegister", { body: { firstName: "Bola", lastName: "Test", email: "Bola@Example.com", password: "longenough", marketingOptIn: false } }, ctx);
    assert.equal(reg.customer.email, "bola@example.com");
    const list = callMock("saveAddress", { body: { label: "Home", isDefault: false, firstName: "Bola", lastName: "Test", phone: "08031234567", line1: "2 Market Road", city: "Ilesha", state: "Osun", country: "NG" } }, ctx);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.isDefault, true, "first address becomes the default");
    expectError(() => callMock("customerRegister", { body: { firstName: "B", lastName: "T", email: "bola@example.com", password: "longenough", marketingOptIn: false } }, session()), 409);
    callMock("customerLogout", {}, ctx);
    expectError(() => callMock("listAddresses", {}, ctx), 401);
  });

  it("password reset requests never reveal whether an account exists", () => {
    assert.deepEqual(callMock("customerRequestPasswordReset", { body: { email: "nobody@example.com" } }), { ok: true });
    assert.deepEqual(callMock("customerRequestPasswordReset", { body: { email: "customer@queenpalace.test" } }), { ok: true });
  });
});

describe("homepage", () => {
  it("fills live stats and FAQ items from data", () => {
    const home = callMock("getHomepage", {});
    const hero = home.sections.find((s) => s.type === "hero");
    assert.ok(hero && hero.type === "hero");
    assert.equal(hero.stats.find((s) => s.source === "collections")?.value, 5);
    const faq = home.sections.find((s) => s.type === "faq");
    assert.ok(faq && faq.type === "faq" && (faq.items?.length ?? 0) > 0);
  });
});

describe("nigerian phone numbers", () => {
  it("accepts local and international mobile formats and rejects others", async () => {
    const { isNigerianPhone, normalizeNigerianPhone } = await import("../src/lib/phone");
    for (const ok of ["08031234567", "0803 123 4567", "+2348031234567", "2349011112222", "0701-234-5678"]) assert.ok(isNigerianPhone(ok), ok);
    for (const bad of ["0803123456", "12345678901", "+447700900123", "06031234567", ""]) assert.ok(!isNigerianPhone(bad), bad);
    assert.equal(normalizeNigerianPhone("0803 123 4567"), "+2348031234567");
  });
});
