// Regenerates docs/API_CONTRACT.md from src/lib/api/contract.ts (run: npm run docs:api).
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/api/contract.ts", import.meta.url), "utf8");
const iface = src.slice(src.indexOf("export interface Contract"), src.indexOf("export const routes"));
const routesSrc = src.slice(src.indexOf("export const routes"));

// Split the top-level generic arguments of Endpoint<...>.
function splitArgs(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if ("<{([".includes(ch)) depth++;
    if (">})]".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const routes = {};
for (const m of routesSrc.matchAll(/^\s+(\w+): \{ method: "(\w+)", path: "([^"]+)"(?:, auth: "(\w+)")? \}/gm)) routes[m[1]] = { method: m[2], path: m[3], auth: m[4] ?? "public" };

const sections = [];
let current = { title: "Storefront", rows: [] };
for (const line of iface.split("\n")) {
  const sec = line.match(/\/\* -+ ([\w ,&-]+?) \*\//);
  if (sec) {
    if (current.rows.length) sections.push(current);
    const t = sec[1].trim();
    current = { title: t[0].toUpperCase() + t.slice(1), rows: [] };
    continue;
  }
  const m = line.match(/^\s+(\w+): Endpoint<(.*)>;\s*$/);
  if (!m) continue;
  const [params, query, body, res] = splitArgs(m[2]).map((a) => (a === "undefined" ? "" : "`" + a.replace(/\/\*\*.*?\*\/\s*/g, "").replace(/\|/g, "\\|") + "`"));
  const r = routes[m[1]];
  current.rows.push(`| ${m[1]} | \`${r?.method} ${r?.path}\` | ${r?.auth} | ${params} | ${query} | ${body} | ${res} |`);
}
if (current.rows.length) sections.push(current);

const head = readFileSync(new URL("../docs/API_CONTRACT.md", import.meta.url), "utf8").split("\n## ")[0].split("\n## Conventions")[0];
const conventions = readFileSync(new URL("../docs/API_CONTRACT.md", import.meta.url), "utf8").match(/## Conventions[\s\S]*?(?=\n## )/)[0];
const total = sections.reduce((n, s) => n + s.rows.length, 0);
let md = `${head.replace(/^\d+ endpoints\.\s*$/gm, "").trim()}\n\n${conventions.replace(/^\d+ endpoints\.\s*$/gm, "").trim()}\n\n${total} endpoints.\n`;
for (const s of sections) md += `\n## ${s.title}\n\n| Name | Method and path | Auth | Path params | Query | Body | Response |\n|---|---|---|---|---|---|---|\n${s.rows.join("\n")}\n`;
writeFileSync(new URL("../docs/API_CONTRACT.md", import.meta.url), md);
console.log(`wrote ${total} endpoints in ${sections.length} sections`);
