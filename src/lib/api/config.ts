/**
 * Runtime data-source configuration.
 *
 * mock: the storefront talks to the in-process mock backend. Server components call it
 *       directly; browser code calls the same handlers over HTTP at /api/mock.
 * live: everything goes to the Fastify backend.
 */
export type DataMode = "mock" | "live";

export const dataMode: DataMode = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";
export const isMockMode = dataMode === "mock";

const trimSlash = (s: string) => s.replace(/\/+$/, "");

/** Base URL used from the browser. */
export function browserApiBase(): string {
  if (isMockMode) return "/api/mock";
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set. Set it or switch NEXT_PUBLIC_DATA_MODE to mock.");
  return trimSlash(url);
}

/** Base URL used from server components and route handlers (live mode only). */
export function serverApiBase(): string {
  const url = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("API_BASE_URL is not set. Set it or switch NEXT_PUBLIC_DATA_MODE to mock.");
  return trimSlash(url);
}

export const siteUrl = trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
