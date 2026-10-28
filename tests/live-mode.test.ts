/**
 * Live mode must never fall back to mock data. Environment is set before any app module loads
 * (node:test runs each file in its own process). Uses a stubbed fetch: no real backend involved.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.NEXT_PUBLIC_DATA_MODE = "live";
process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test/v1/";
delete process.env.API_BASE_URL;

const calls: string[] = [];
globalThis.fetch = (async (url: string) => {
  calls.push(url);
  throw new TypeError("fetch failed");
}) as typeof fetch;

describe("live mode", () => {
  it("is selected by NEXT_PUBLIC_DATA_MODE=live and targets the configured API", async () => {
    const config = await import("../src/lib/api/config");
    assert.equal(config.dataMode, "live");
    assert.equal(config.isMockMode, false);
    assert.equal(config.browserApiBase(), "https://api.example.test/v1", "browser code uses the real API, not /api/mock");
    assert.equal(config.serverApiBase(), "https://api.example.test/v1", "server code falls back to the public URL when API_BASE_URL is unset");
  });

  it("surfaces API failures instead of returning mock data", async () => {
    const { createApiClient, ApiError } = await import("../src/lib/api/client");
    const { serverApiBase } = await import("../src/lib/api/config");
    const { repositoryFrom } = await import("../src/lib/data/storefront");
    const client = createApiClient(serverApiBase(), { retries: 0 });
    const repo = repositoryFrom((name, req) => client.call(name, req));
    calls.length = 0;
    await assert.rejects(repo.collections(), (e: unknown) => e instanceof ApiError && e.code === "network_error");
    await assert.rejects(repo.product("bone-straight-double-drawn"), (e: unknown) => e instanceof ApiError, "a network failure is not treated as 'product not found'");
    assert.deepEqual(calls, ["https://api.example.test/v1/collections", "https://api.example.test/v1/products/bone-straight-double-drawn"]);
  });

  it("disables the mock HTTP API", async () => {
    const { GET } = await import("../src/app/api/mock/[...path]/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/mock/store/settings"), { params: Promise.resolve({ path: ["store", "settings"] }) });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "mock_disabled");
  });

  it("requires an API URL rather than guessing one", async () => {
    const before = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const { browserApiBase } = await import("../src/lib/api/config");
    assert.throws(() => browserApiBase(), /NEXT_PUBLIC_API_BASE_URL is not set/);
    process.env.NEXT_PUBLIC_API_BASE_URL = before;
  });
});
