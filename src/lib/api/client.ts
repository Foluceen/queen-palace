/**
 * Centralized typed API client. All network access in the app goes through `createApiClient`.
 *
 *   const api = createApiClient(browserApiBase());
 *   const cart = await api.call("addCartLines", { params: { cartId }, body: { lines } });
 *
 * Behaviour, identical in mock and live mode:
 * - Paths and methods come only from `routes` in contract.ts.
 * - Cookies are sent (`credentials: "include"`); session cookies are httpOnly and never read here.
 * - Each request has a timeout. Safe GETs are retried once on network errors and 502/503/504.
 *   Mutations are never retried automatically (checkout uses its own idempotency key).
 * - Errors become `ApiError` with the backend's `{ error: { code, message, fields } }`.
 * - Responses for key endpoints are shape-checked (validate.ts). A mismatch throws
 *   `contract_mismatch` instead of letting the UI render wrong data.
 * - 401/403 on authenticated endpoints are reported through `onAuthError`.
 */
import type { ApiErrorBody } from "@/lib/types";
import { routes, type EndpointName, type RequestOf, type ResponseOf } from "./contract";
import { validateResponse } from "./validate";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNotFound() {
    return this.status === 404;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  /** Network failure or 5xx: worth offering a retry. */
  get isRetryable() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
  /** The backend has not built this endpoint yet (501), or answered with a different shape. */
  get isUnavailable() {
    return this.status === 501 || this.code === "contract_mismatch";
  }
}

export interface ClientOptions {
  /** Extra fetch init (e.g. Next.js caching: { next: { revalidate: 60, tags: [...] } }). */
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } };
  /** Forwarded headers, e.g. the cookie header from a server component request. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Automatic retries for GET requests on network errors and 502/503/504 (default 1). */
  retries?: number;
  /** Called when an authenticated endpoint answers 401 or 403. */
  onAuthError?: (info: { status: 401 | 403; scope: "customer" | "admin"; endpoint: EndpointName }) => void;
  /** Disable response shape checks (tests only). */
  skipValidation?: boolean;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buildPath(template: string, params: Record<string, string> | undefined): string {
  return template.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined) throw new Error(`Missing path parameter "${key}" for ${template}`);
    return encodeURIComponent(value);
  });
}

export function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function createApiClient(baseUrl: string, defaults: ClientOptions = {}) {
  async function once<K extends EndpointName>(name: K, req: { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }, options: ClientOptions): Promise<ResponseOf<K>> {
    const route = routes[name];
    const url = `${baseUrl}${buildPath(route.path, req.params)}${buildQuery(req.query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? defaults.timeoutMs ?? 15000);
    const init = { ...defaults.init, ...options.init };

    let res: Response;
    try {
      res = await fetch(url, {
        method: route.method,
        credentials: "include",
        ...init,
        headers: {
          Accept: "application/json",
          ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...defaults.headers,
          ...options.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = (err instanceof DOMException || err instanceof Error) && err.name === "AbortError";
      throw new ApiError(0, aborted ? "timeout" : "network_error", aborted ? "The request took too long. Check your connection and try again." : "We couldn't reach the store. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 204) return undefined as unknown as ResponseOf<K>;
    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(res.status || 502, "invalid_response", "The store returned an unexpected response.");
      }
    }
    if (!res.ok) {
      const body = data as Partial<ApiErrorBody> | undefined;
      if ((res.status === 401 || res.status === 403) && route.auth) {
        (options.onAuthError ?? defaults.onAuthError)?.({ status: res.status, scope: route.auth, endpoint: name });
      }
      const fallback =
        res.status === 501
          ? "This part of the store isn't available yet."
          : res.status >= 500
            ? "The store is having trouble right now. Try again in a moment."
            : `Request failed with status ${res.status}.`;
      throw new ApiError(res.status, body?.error?.code ?? (res.status === 501 ? "not_implemented" : "http_error"), body?.error?.message ?? fallback, body?.error?.fields);
    }
    if (!(options.skipValidation ?? defaults.skipValidation)) {
      const problem = validateResponse(name, data);
      if (problem) {
        if (typeof console !== "undefined") console.error(`[api] ${route.method} ${route.path} returned a shape the frontend can't use: ${problem}`);
        throw new ApiError(502, "contract_mismatch", "The store returned data in an unexpected format.", { _contract: problem });
      }
    }
    return data as ResponseOf<K>;
  }

  async function call<K extends EndpointName>(name: K, request: RequestOf<K> = {} as RequestOf<K>, options: ClientOptions = {}): Promise<ResponseOf<K>> {
    const req = request as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };
    const retries = routes[name].method === "GET" ? (options.retries ?? defaults.retries ?? 1) : 0;
    for (let attempt = 0; ; attempt++) {
      try {
        return await once<K>(name, req, options);
      } catch (err) {
        const retryable = err instanceof ApiError && (err.status === 0 || RETRYABLE_STATUS.has(err.status)) && err.code !== "contract_mismatch";
        if (!retryable || attempt >= retries) throw err;
        await sleep(300 * (attempt + 1));
      }
    }
  }

  return { call, baseUrl };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function errorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
