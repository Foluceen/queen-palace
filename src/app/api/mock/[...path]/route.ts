/**
 * HTTP surface of the mock backend, used by client components in mock mode.
 * Responds exactly like the Fastify backend would for the same contract.
 * Disabled (404) when NEXT_PUBLIC_DATA_MODE=live.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isMockMode } from "@/lib/api/config";
import { handlers, MockHttpError, type MockContext } from "@/lib/mock/backend";
import { getDb } from "@/lib/mock/db";
import { matchRoute } from "@/lib/mock/router";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isMockMode) {
    return NextResponse.json({ error: { code: "mock_disabled", message: "The mock API is disabled in live mode." } }, { status: 404 });
  }
  const { path } = await ctx.params;
  const route = matchRoute(req.method, `/${path.join("/")}`);
  if (!route) {
    return NextResponse.json({ error: { code: "not_found", message: `No mock endpoint for ${req.method} /${path.join("/")}.` } }, { status: 404 });
  }

  let body: unknown = undefined;
  if (req.method !== "GET" && req.method !== "DELETE") {
    const text = await req.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: { code: "invalid_json", message: "Request body is not valid JSON." } }, { status: 400 });
      }
    }
  }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());

  const pendingCookies: { name: string; value: string; maxAge: number }[] = [];
  const mockCtx: MockContext = {
    getCookie: (name) => req.cookies.get(name)?.value,
    setCookie: (name, value, maxAge) => pendingCookies.push({ name, value, maxAge }),
    clearCookie: (name) => pendingCookies.push({ name, value: "", maxAge: 0 }),
  };

  // Small artificial latency so loading states are visible during development.
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

  try {
    const handler = handlers[route.name] as unknown as (r: unknown, c: MockContext, db: ReturnType<typeof getDb>) => unknown;
    const result = handler({ params: route.params, query, body }, mockCtx, getDb());
    const res = NextResponse.json(result, { headers: { "Cache-Control": "no-store", "X-Data-Mode": "mock" } });
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: c.maxAge, secure: process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:" });
    }
    return res;
  } catch (err) {
    if (err instanceof MockHttpError) {
      return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields } }, { status: err.status });
    }
    console.error("[mock api]", err);
    return NextResponse.json({ error: { code: "internal_error", message: "The mock backend hit an unexpected error." } }, { status: 500 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
