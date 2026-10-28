// Smoke test against a running server (default http://localhost:3000, mock mode).
//   npm run build && npm start   # in one terminal
//   npm run smoke                # in another (or: BASE_URL=http://localhost:3100 npm run smoke)
// Checks every route responds, then walks a guest checkout and admin permission checks
// through the same HTTP API the UI uses.

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API = `${BASE}/api/mock`;
let failures = 0;
const runKey = `smoke-${Date.now()}`;

const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

async function page(path, expect = 200) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  ok(res.status === expect, `GET ${path} → ${res.status}`);
}

async function call(method, path, body, cookie) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

const storeRoutes = [
  "/", "/collections", "/collections/futura-wig", "/collections/bone-straight", "/collections/factory-wigs", "/collections/braids-extensions", "/collections/hair-maintains",
  "/collections/bone-straight?options=Length:18%22&sort=price_asc", "/products/bone-straight-double-drawn", "/products/futura-body-wave", "/products/care-silk-bonnet",
  "/search", "/search?q=613", "/search?q=zzzz", "/cart", "/checkout", "/track", "/account", "/wishlist", "/contact",
  "/about", "/hair-care", "/faq", "/shipping", "/returns", "/privacy", "/terms",
];
const adminRoutes = [
  "/admin/login", "/admin", "/admin/products", "/admin/products/new", "/admin/products/prod_1", "/admin/inventory", "/admin/collections", "/admin/media",
  "/admin/orders", "/admin/orders/ord_s0", "/admin/storefront", "/admin/discounts", "/admin/reviews", "/admin/settings/shipping-payments", "/admin/settings/branding", "/admin/staff",
];

console.log(`Smoke testing ${BASE}\n`);
for (const r of [...storeRoutes, ...adminRoutes]) await page(r);
await page("/products/does-not-exist", 404);
await page("/collections/does-not-exist", 404);
await page("/nope", 404);

console.log("\nGuest checkout");
const detail = await call("GET", "/products/bone-straight-double-drawn");
const variant = detail.data.product.variants.find((v) => v.availability !== "out_of_stock");
ok(!!variant, "found an in-stock variant");
let cart = await call("POST", "/carts", { lines: [{ variantId: variant.id, quantity: 1 }] });
ok(cart.status === 200 && cart.data.itemCount === 1, "created cart with one item");
ok(cart.data.totals.subtotal === variant.price, "subtotal comes from backend price");
const bad = await call("POST", `/carts/${cart.data.id}/discounts`, { code: "NOTREAL" });
ok(bad.status === 422, "invalid discount code rejected");
const disc = await call("POST", `/carts/${cart.data.id}/discounts`, { code: "WELCOME10" });
ok(disc.status === 200 && disc.data.totals.discountTotal > 0, "WELCOME10 applied by backend");
// Bank transfer ships disabled until real account details exist; turn it on with test details for this run.
const setup = await call("POST", "/admin/auth/login", { email: "owner@queenluxuryhair.test", password: "demo-owner" });
const pay = await call("GET", "/admin/settings/payments", null, setup.cookie);
const enabled = await call("PUT", "/admin/settings/payments", { ...pay.data, bankTransfer: { ...pay.data.bankTransfer, enabled: true, bankName: "Test Bank", accountName: "Smoke Test", accountNumber: "0000000000" } }, setup.cookie);
ok(enabled.status === 200, "owner enables bank transfer with test details (mock only)");
const ilesha = await call("POST", "/checkout/shipping-rates", { cartId: cart.data.id, address: { state: "Osun", city: "Ilesha" } });
ok(ilesha.status === 200 && ilesha.data.some((r) => r.amount === 0), "Ilesha gets rider delivery and free store pickup");
const rates = await call("POST", "/checkout/shipping-rates", { cartId: cart.data.id, address: { state: "Lagos", city: "Lekki" } });
ok(rates.status === 200 && rates.data.length > 0, `got ${rates.data.length} Lagos delivery quotes`);
const rate = rates.data[0];
const missing = await call("POST", "/checkout", { cartId: cart.data.id, contact: { email: "x", phone: "1", marketingOptIn: false }, shippingAddress: { firstName: "", lastName: "", phone: "1", line1: "", city: "", state: "Lagos", country: "NG" }, shippingRateId: rate.id, paymentMethod: "bank_transfer", idempotencyKey: "smoke-bad" });
ok(missing.status === 422 && missing.data.error.fields?.email, "checkout validates fields");
const order = await call("POST", "/checkout", {
  cartId: cart.data.id,
  contact: { email: "smoke@example.com", phone: "08030000000", marketingOptIn: false },
  shippingAddress: { firstName: "Ada", lastName: "Test", phone: "08030000000", line1: "1 Admiralty Way", city: "Lekki", state: "Lagos", country: "NG" },
  shippingRateId: rate.id,
  paymentMethod: "bank_transfer",
  idempotencyKey: runKey,
});
ok(order.status === 200, "order placed");
ok(order.data.order.paymentStatus === "awaiting_transfer", "bank transfer order is awaiting transfer, not paid");
ok(order.data.order.totals.total === rate.totals.total, "order total matches the backend quote");
const again = await call("POST", "/checkout", { idempotencyKey: runKey, cartId: "gone" });
ok(again.status === 200 && again.data.order.number === order.data.order.number, "idempotent retry returns the same order");
const fetched = await call("GET", `/orders/${order.data.order.number}?token=${order.data.order.accessToken}`);
ok(fetched.status === 200, "guest can open own order with token");
const noToken = await call("GET", `/orders/${order.data.order.number}?token=wrong`);
ok(noToken.status === 404, "wrong token cannot read order");
const tracked = await call("POST", "/orders/track", { number: order.data.order.number, email: "smoke@example.com" });
ok(tracked.status === 200, "tracking by number and email works");
await page(`/order/${order.data.order.number}?token=${order.data.order.accessToken}`);

console.log("\nAdmin permissions");
const anon = await call("GET", "/admin/dashboard?days=30");
ok(anon.status === 401, "admin API rejects anonymous requests");
const owner = await call("POST", "/admin/auth/login", { email: "owner@queenluxuryhair.test", password: "demo-owner" });
ok(owner.status === 200 && owner.cookie, "owner signs in");
const fulfil = await call("POST", "/admin/auth/login", { email: "fulfilment@queenluxuryhair.test", password: "demo-fulfilment" });
ok(fulfil.status === 200, "fulfilment staff signs in");
ok((await call("GET", "/admin/settings/payments", null, fulfil.cookie)).status === 403, "fulfilment cannot read payment settings");
ok((await call("GET", "/admin/settings/payments", null, owner.cookie)).status === 200, "owner can read payment settings");
const placed = await call("GET", `/admin/orders?q=${order.data.order.number}`, null, fulfil.cookie);
const orderId = placed.data.items[0]?.id;
ok(!!orderId, "fulfilment can find the new order");
const shipEarly = await call("POST", `/admin/orders/${orderId}/fulfillment`, { fulfillmentStatus: "shipped", notifyCustomer: false }, fulfil.cookie);
ok(shipEarly.status === 409, "cannot ship before the transfer is confirmed");
const confirm = await call("POST", `/admin/orders/${orderId}/transfer-received`, { reference: "SMOKE123" }, fulfil.cookie);
ok(confirm.status === 200 && confirm.data.paymentStatus === "paid", "staff confirms transfer, order becomes paid");
const refund = await call("POST", `/admin/orders/${orderId}/refunds`, { amount: 100, reason: "test" }, fulfil.cookie);
ok(refund.status === 403, "fulfilment cannot refund");
const colls = await call("GET", "/admin/collections", null, owner.cookie);
ok(colls.data.length === 5 && colls.data[0].title === "Futura Wig", "five seeded collections in admin order");
const created = await call("POST", "/admin/collections", { title: "Smoke Test Wigs", handle: "", summary: "", description: "", status: "published", imageId: null, seo: {}, position: 0 }, owner.cookie);
ok(created.status === 200, "owner creates a collection");
const reorder = await call("PUT", "/admin/collections/order", { ids: [created.data.id, ...colls.data.map((c) => c.id)] }, owner.cookie);
ok(reorder.data[0].id === created.data.id, "collections reorder");
ok((await call("GET", "/collections")).data[0].handle === "smoke-test-wigs", "storefront collection order follows admin");
ok((await call("DELETE", `/admin/collections/${created.data.id}`, null, owner.cookie)).status === 200, "owner deletes the collection");

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures ? 1 : 0);
