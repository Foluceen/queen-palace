/**
 * Preview replacement for src/lib/api/browser.ts: the same typed `call()` surface, served
 * by the real mock backend running in the page. Cookies are kept in memory, like httpOnly ones.
 */
import type { EndpointName, RequestOf, ResponseOf } from "@/lib/api/contract";
import { ApiError } from "@/lib/api/client";
import { callMock, MockHttpError, type MockContext } from "@/lib/mock/backend";

const jar = new Map<string, string>();
const ctx: MockContext = {
  getCookie: (n) => jar.get(n),
  setCookie: (n, v, maxAge) => (maxAge > 0 ? jar.set(n, v) : jar.delete(n)),
  clearCookie: (n) => jar.delete(n),
};

const delay = () => new Promise((r) => setTimeout(r, 90 + Math.random() * 160));

const client = {
  baseUrl: "preview",
  async call<K extends EndpointName>(name: K, request: RequestOf<K> = {} as RequestOf<K>): Promise<ResponseOf<K>> {
    await delay();
    const r = request as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };
    // Mirror HTTP: query values arrive as strings, bodies as JSON.
    const query = r.query ? Object.fromEntries(Object.entries(r.query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])) : undefined;
    const body = r.body === undefined ? undefined : JSON.parse(JSON.stringify(r.body));
    try {
      return callMock(name, { params: r.params, query, body } as RequestOf<K>, ctx);
    } catch (err) {
      if (err instanceof MockHttpError) throw new ApiError(err.status, err.code, err.message, err.fields);
      console.error(err);
      throw new ApiError(500, "internal_error", "The preview backend hit an unexpected error.");
    }
  },
};

export function api() {
  return client;
}
