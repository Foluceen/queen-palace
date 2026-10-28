/**
 * Centralized typed API client. All network access in the app goes through `createApiClient`.
 *
 *   const api = createApiClient(browserApiBase());
 *   const cart = await api.call("addCartLines", { params: { cartId }, body: { lines } });
 */
import type { ApiErrorBody } from "@/lib/types";
import { routes, type EndpointName, type RequestOf, type ResponseOf } from "./contract";

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
}

export interface ClientOptions {
  /** Extra fetch init (e.g. Next.js caching: { next: { revalidate: 60, tags: [...] } }). */
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } };
  /** Forwarded headers, e.g. the cookie header from a server component request. */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

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
  async function call<K extends EndpointName>(name: K, request: RequestOf<K> = {} as RequestOf<K>, options: ClientOptions = {}): Promise<ResponseOf<K>> {
    const route = routes[name];
    const req = request as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };
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
      const aborted = err instanceof DOMException && err.name === "AbortError";
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
        throw new ApiError(res.status, "invalid_response", "The store returned an unexpected response.");
      }
    }
    if (!res.ok) {
      const body = data as Partial<ApiErrorBody> | undefined;
      throw new ApiError(res.status, body?.error?.code ?? "http_error", body?.error?.message ?? `Request failed with status ${res.status}.`, body?.error?.fields);
    }
    return data as ResponseOf<K>;
  }

  return { call, baseUrl };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function errorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
