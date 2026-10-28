// Generates the Queen Luxury Hair logo system from one source of truth.
//   node scripts/build-brand.mjs
// Outputs vector SVGs to public/brand, the favicon to src/app/icon.svg, path data for the
// <Logo> React component, and PNGs (app icons, social avatar, OG image) via Playwright.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "brand");
mkdirSync(out, { recursive: true });

const COLORS = {
  espresso: "#1F1612",
  cocoa: "#5B3220",
  gold: "#C99A55",
  goldDeep: "#B0874A",
  cream: "#F8F1EA",
  blush: "#F2C9DA",
  night: "#120D0B",
};

/* ------------------------------------------------------------- monogram */
// 64×64 grid. A crowned Q: the crown sits on the ring, and the Q's tail is a
// loose strand of hair. Filled shapes only, so it renders crisply at 16px.
const ring = "M32 20.6a16.4 16.4 0 1 1 0 32.8a16.4 16.4 0 1 1 0-32.8Zm0 4.6a11.8 11.8 0 1 0 0 23.6a11.8 11.8 0 1 0 0-23.6Z";
const crown = "M20.4 23.6 18.6 10.8l7.3 6.2L32 7.6l6.1 9.4 7.3-6.2-1.8 12.8c-3.6-1.6-7.6-2.5-11.6-2.5s-8 .9-11.6 2.5Z";
const jewels = "M18.6 8.1a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2ZM32 4.6a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6ZM45.4 8.1a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2Z";
// Tapered strand: thick where it leaves the ring, fine at the tip.
const strand = "M34.2 44.4c4.9 1.4 7.7 4.7 10 8.3 2.4 3.6 5.6 6 10.7 4.9 1.5-.3 2.6-1.1 3.3-2.1-1.6 3.5-5 5.4-9.4 5-5.4-.5-8.4-4.4-10.6-8-1.8-2.9-3.6-4.9-6.9-6.1Z";
const MONO_PATHS = { ring, crown, jewels, strand };
const monoPath = Object.values(MONO_PATHS).join(" ");

/* ------------------------------------------------------------- wordmark */
const require = createRequire(import.meta.url);
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const load = (id) => opentype.parse(toArrayBuffer(readFileSync(require.resolve(id))));
const serif = load("@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff");
const script = load("@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff");

/** Lays out text with tracking (in em) and returns path data + width. */
function setText(font, text, size, trackingEm, x, baseline) {
  let cursor = x;
  const parts = [];
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    parts.push(g.getPath(cursor, baseline, size).toPathData(2));
    cursor += (g.advanceWidth / font.unitsPerEm) * size;
    if (i < glyphs.length - 1) {
      cursor += (font.getKerningValue(g, glyphs[i + 1]) / font.unitsPerEm) * size;
      cursor += trackingEm * size;
    }
  });
  return { d: parts.join(""), width: cursor - x };
}
const measure = (font, text, size, tracking) => setText(font, text, size, tracking, 0, 0).width;

// Wordmark lockup: a small crown, "QUEEN" in spaced serif capitals, "Luxury Hair" in script.
const QUEEN = "QUEEN";
const SCRIPT = "Luxury Hair";
const qSize = 21;
const qTrack = 0.42;
const sSize = 36;
const qW = measure(serif, QUEEN, qSize, qTrack);
const sW = measure(script, SCRIPT, sSize, 0);
const W = Math.ceil(Math.max(qW, sW) + 8);
const crownScale = 0.42;
// Crown + jewels occupy x 16.5..47.5, y 2.3..24 on the 64 grid.
const crownW = 31 * crownScale;
const crownTransform = (cx, top) => `translate(${(cx - 32 * crownScale).toFixed(2)} ${(top - 2.3 * crownScale).toFixed(2)}) scale(${crownScale})`;
const CROWN_PATH = [crown, jewels].join(" ");
const H_TOP = 0;
const qBase = 34; // baseline of QUEEN
const sBase = 66; // baseline of the script line
const L1 = setText(serif, QUEEN, qSize, qTrack, (W - qW) / 2 + (qTrack * qSize) / 2, qBase);
const L2 = setText(script, SCRIPT, sSize, 0, (W - sW) / 2, sBase);
const H = { width: W, height: 76, markTransform: crownTransform(W / 2, H_TOP) };
void crownW;

// Stacked lockup for square spaces: the crowned-Q monogram above the wordmark (no small crown).
const stackW = W;
const stackMarkX = (stackW - 64) / 2;
const S1 = setText(serif, QUEEN, qSize, qTrack, (W - qW) / 2 + (qTrack * qSize) / 2, 64 + 34);
const S2 = setText(script, SCRIPT, sSize, 0, (W - sW) / 2, 64 + 66);
const S = { width: stackW, height: 64 + 76 };

/* ---------------------------------------------------------------- files */
const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const NAME = "Queen Luxury Hair";

const horizontal = (mark, text) => svg(H.width, H.height, `<g transform="${H.markTransform}"><path fill="${mark}" d="${CROWN_PATH}"/></g><path fill="${text}" d="${L1.d}"/><path fill="${text}" d="${L2.d}"/>`, NAME);
const stacked = (mark, text) => svg(S.width, S.height, `<g transform="translate(${stackMarkX} 0)"><path fill="${mark}" d="${monoPath}"/></g><path fill="${text}" d="${S1.d}"/><path fill="${text}" d="${S2.d}"/>`, NAME);
const monogram = (fill) => svg(64, 64, `<path fill="${fill}" d="${monoPath}"/>`, NAME);
const appIcon = (bg, fill, radius = 14) => svg(64, 64, `<rect width="64" height="64" rx="${radius}" fill="${bg}"/><g transform="translate(6.4 7.2) scale(.8)"><path fill="${fill}" d="${monoPath}"/></g>`, NAME);

const files = {
  "logo-horizontal-light.svg": horizontal(COLORS.goldDeep, COLORS.espresso),
  "logo-horizontal-dark.svg": horizontal(COLORS.gold, COLORS.cream),
  "logo-stacked-light.svg": stacked(COLORS.goldDeep, COLORS.espresso),
  "logo-stacked-dark.svg": stacked(COLORS.gold, COLORS.cream),
  "monogram-gold.svg": monogram(COLORS.gold),
  "monogram-espresso.svg": monogram(COLORS.espresso),
  "monogram-cream.svg": monogram(COLORS.cream),
  "app-icon.svg": appIcon(COLORS.espresso, COLORS.gold),
  "app-icon-dark.svg": appIcon(COLORS.night, COLORS.gold),
};
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
writeFileSync(join(root, "src", "app", "icon.svg"), files["app-icon.svg"]);

/* ------------------------------------------------------ React path data */
const ts = `/* Generated by scripts/build-brand.mjs. Do not edit by hand. */
export const MONOGRAM_PATH = ${JSON.stringify(monoPath)};
export const CROWN_PATH = ${JSON.stringify(CROWN_PATH)};
export const HORIZONTAL = ${JSON.stringify({ width: H.width, height: H.height, markTransform: H.markTransform, line1: L1.d, line2: L2.d })};
export const STACKED = ${JSON.stringify({ width: S.width, height: S.height, markX: stackMarkX, line1: S1.d, line2: S2.d })};
`;
mkdirSync(join(root, "src", "components", "brand"), { recursive: true });
writeFileSync(join(root, "src", "components", "brand", "logo-paths.ts"), ts);

/* ----------------------------------------------------------------- PNGs */
const pw = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(name, html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path: join(out, name), omitBackground: true, clip: { x: 0, y: 0, width, height } });
}
const img = (file, w, h) => `<img src="data:image/svg+xml;base64,${Buffer.from(files[file]).toString("base64")}" width="${w}" height="${h}" style="display:block">`;
await png("icon-512.png", img("app-icon.svg", 512, 512), 512, 512);
await png("icon-192.png", img("app-icon.svg", 192, 192), 192, 192);
await png("apple-touch-icon.png", `<div style="width:180px;height:180px;background:${COLORS.espresso};display:grid;place-items:center">${img("monogram-gold.svg", 132, 132)}</div>`, 180, 180);
await png(
  "social-avatar.png",
  `<div style="width:1080px;height:1080px;background:${COLORS.cream};display:grid;place-items:center">
     <div style="width:860px;height:860px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#f9e3ec 0%,${COLORS.cream} 70%);display:grid;place-items:center">${img("logo-stacked-light.svg", Math.round(S.width * 4.6), Math.round(S.height * 4.6))}</div></div>`,
  1080,
  1080,
);
await png(
  "og-image.png",
  `<div style="width:1200px;height:630px;background:${COLORS.cream};display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;position:relative;overflow:hidden">
     <div style="position:absolute;left:50%;top:50%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(circle,#f8dce8 0%,${COLORS.cream} 62%)"></div>
     <div style="position:relative">${img("logo-horizontal-light.svg", Math.round(H.width * 3.4), Math.round(H.height * 3.4))}</div>
     <div style="position:relative;margin-top:34px;font-size:28px;letter-spacing:.14em;text-transform:uppercase;color:${COLORS.cocoa};font-family:system-ui,sans-serif">Wigs · Bone straight · Braids · Hair care</div>
     <div style="position:relative;margin-top:12px;font-size:24px;color:${COLORS.espresso};font-family:system-ui,sans-serif">Ijoka, Ilesha, Osun State</div>
   </div>`,
  1200,
  630,
);
await browser.close();
writeFileSync(join(root, "src", "app", "apple-icon.png"), readFileSync(join(out, "apple-touch-icon.png")));
writeFileSync(join(root, "src", "app", "opengraph-image.png"), readFileSync(join(out, "og-image.png")));
console.log(`brand built: horizontal ${H.width}×${H.height}, stacked ${S.width}×${S.height}`);
