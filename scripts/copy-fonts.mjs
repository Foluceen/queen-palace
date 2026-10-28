// Copies self-hosted font files from @fontsource packages into src/app/fonts
// so next/font/local can subset, preload and cache them without a network call at build time.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src", "app", "fonts");
mkdirSync(out, { recursive: true });

const files = [
  ["@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", "manrope-latin.woff2"],
  ["@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2", "manrope-latin-ext.woff2"],
  ["@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", "bricolage-latin.woff2"],
  ["@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-wght-normal.woff2", "bricolage-latin-ext.woff2"],
];

let missing = 0;
for (const [src, dest] of files) {
  const from = join(root, "node_modules", src);
  if (!existsSync(from)) {
    missing++;
    console.warn(`[fonts] missing ${src}`);
    continue;
  }
  copyFileSync(from, join(out, dest));
}
if (missing) {
  console.warn("[fonts] Some font files were not found. Run `npm install` and then `npm run fonts`.");
}
