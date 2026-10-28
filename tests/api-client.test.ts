/**
 * API client behaviour with a stubbed fetch (no network, no backend).
 * These are frontend unit tests; they do not prove the real API works.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ApiError, buildPath, buildQuery, createApiClient } from "../src/lib/api/client";
import { emitAuthEvent, onAuthEvent } from "../src/lib/api/auth-events";
import { safePaymentRedirect, shouldRotateIdempotencyKey } from "../src/lib/checkout";
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
    stub(json(200, { name: "Queen Luxury Hair", address: "Ijoka", currency: "NGN" }));
    await assert.rejects(createApiClient("https://x.test").call("getStoreSettings"), (e: unknown) => e instanceof ApiError && e.code === "contract_mismatch" && /tagline/.test(e.fields?._contract ?? ""));
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
  });

  it("keeps the idempotency key for retryable failures and replaces it after a definite rejection", () => {
    assert.equal(shouldRotateIdempotencyKey(new ApiError(0, "network_error", "x")), false, "the order may exist: retry with the same key");
    assert.equal(shouldRotateIdempotencyKey(new ApiError(502, "http_error", "x")), false);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(429, "rate_limited", "x")), false);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(409, "cart_changed", "x")), true);
    assert.equal(shouldRotateIdempotencyKey(new ApiError(422, "validation_failed", "x")), true);
  });
});
