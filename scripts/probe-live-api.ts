/**
 * Read-only compatibility probe for the real API.
 *
 *   npm run probe:live                                   # https://api.queenpalacebeauty.store/v1
 *   API=https://staging.example/v1 ORIGIN=https://www.example npm run probe:live
 *
 * What it does (no data is created or changed):
 * - CORS preflight from the storefront origin (credentials must be allowed).
 * - Every public GET endpoint in the contract, response checked with the same shape checks the
 *   frontend uses (src/lib/api/validate.ts).
 * - Every authenticated GET without a session: must answer 401 (not 404 or 501).
 * - Mutations are NOT called. Their status is "not probed" and needs a backend-side test.
 *
 * Output: a Markdown table on stdout. Exit code 1 if anything the storefront needs is failing.
 */
import { routes, type EndpointName } from "../src/lib/api/contract";
import { validateResponse } from "../src/lib/api/validate";

const API = (process.env.API ?? "https://api.queenpalacebeauty.store/v1").replace(/\/+$/, "");
const ORIGIN = process.env.ORIGIN ?? "https://www.queenpalacebeauty.store";

const samples: Record<string, string> = {
  handle: "bone-straight",
  slug: "about",
  productId: "probe",
  cartId: "probe",
  lineId: "probe",
  number: "QP-00000",
  code: "PROBE",
  variantId: "probe",
  id: "probe",
};
const fill = (path: string) => path.replace(/:([A-Za-z]+)/g, (_, k: string) => samples[k] ?? "probe");
const queries: Partial<Record<EndpointName, string>> = { search: "?q=hair", getOrder: "?token=probe", listProductReviews: "?page=1" };

type Row = { name: string; method: string; path: string; auth: string; status: string; result: string; ok: boolean | null };

async function main() {
  const rows: Row[] = [];

  // CORS preflight for a credentialed JSON POST from the storefront.
  let cors = "";
  try {
    const pre = await fetch(`${API}/carts`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
    const allowOrigin = pre.headers.get("access-control-allow-origin");
    const allowCreds = pre.headers.get("access-control-allow-credentials");
    cors = pre.ok && allowOrigin === ORIGIN && allowCreds === "true" ? `OK (${pre.status})` : `FAIL: status ${pre.status}, allow-origin=${allowOrigin ?? "missing"}, allow-credentials=${allowCreds ?? "missing"}`;
  } catch (e) {
    cors = `FAIL: ${(e as Error).message}`;
  }

  for (const [name, r] of Object.entries(routes) as [EndpointName, (typeof routes)[EndpointName]][]) {
    const row: Row = { name, method: r.method, path: r.path, auth: r.auth ?? "public", status: "", result: "", ok: null };
    if (r.method !== "GET") {
      row.status = "-";
      row.result = "not probed (mutation)";
      rows.push(row);
      continue;
    }
    try {
      const res = await fetch(`${API}${fill(r.path)}${queries[name] ?? ""}`, { headers: { Accept: "application/json", Origin: ORIGIN } });
      row.status = String(res.status);
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      const code = (body as { error?: { code?: string } } | undefined)?.error?.code;
      if (r.auth) {
        row.ok = res.status === 401;
        row.result = res.status === 401 ? "requires sign-in (expected)" : `expected 401, got ${res.status}${code ? ` ${code}` : ""}`;
      } else if (res.status === 501) {
        row.ok = false;
        row.result = "not implemented (501)";
      } else if (res.status === 404 && r.path.includes(":")) {
        row.ok = null;
        row.result = "404 for a sample id (needs real data to confirm)";
      } else if (!res.ok) {
        row.ok = false;
        row.result = `error ${res.status}${code ? ` ${code}` : ""}`;
      } else {
        const problem = validateResponse(name, body);
        row.ok = !problem;
        row.result = problem ? `shape mismatch: ${problem}` : "OK";
      }
    } catch (e) {
      row.status = "ERR";
      row.ok = false;
      row.result = (e as Error).message;
    }
    rows.push(row);
    await new Promise((res) => setTimeout(res, 250)); // stay well under the API rate limit
  }

  const date = new Date().toISOString();
  console.log(`# Live API probe\n\nAPI: \`${API}\`  \nOrigin: \`${ORIGIN}\`  \nRun: ${date}\n\nCORS preflight (POST /carts): **${cors}**\n`);
  console.log("| Endpoint | Method and path | Auth | HTTP | Result |\n|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.name} | \`${r.method} ${r.path}\` | ${r.auth} | ${r.status} | ${r.ok === true ? "✅ " : r.ok === false ? "❌ " : ""}${r.result.replace(/\|/g, "\\|")} |`);
  const failing = rows.filter((r) => r.ok === false).length;
  console.log(`\n${rows.filter((r) => r.ok).length} passing, ${failing} failing, ${rows.filter((r) => r.ok === null).length} not confirmable without data or a session.`);
  process.exit(failing || !cors.startsWith("OK") ? 1 : 0);
}

void main();
