// Generates the Queen Palace Beauty World logo system from one source of truth.
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
  burgundy: "#6B1630",
  gold: "#C9A45C",
  goldDeep: "#A9833D",
  ivory: "#FAF5EC",
  charcoal: "#221C1E",
  night: "#0E0B0C",
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
const fontFile = (w) => require.resolve(`@fontsource/fraunces/files/fraunces-latin-${w}-normal.woff`);
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const display = opentype.parse(toArrayBuffer(readFileSync(fontFile(600))));
const subline = opentype.parse(toArrayBuffer(readFileSync(fontFile(500))));

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

const line1Size = 27;
const line1 = setText(display, "QUEEN PALACE", line1Size, 0.06, 0, 0);
// Justify the second line to the first line's width.
const line2Size = 12.6;
const raw2 = setText(subline, "BEAUTY WORLD", line2Size, 0, 0, 0);
const gaps2 = "BEAUTY WORLD".length - 1;
const track2 = (line1.width - raw2.width) / gaps2 / line2Size;

const markSize = 64;
const gap = 16;
const textX = markSize + gap;
const L1 = setText(display, "QUEEN PALACE", line1Size, 0.06, textX, 34);
const L2 = setText(subline, "BEAUTY WORLD", line2Size, track2, textX, 54);
const H = { width: Math.ceil(textX + line1.width + 2), height: 64 };

// Stacked lockup for square spaces (centred under the mark).
const stackW = Math.ceil(line1.width + 4);
const stackMarkX = (stackW - 64) / 2;
const S1 = setText(display, "QUEEN PALACE", line1Size, 0.06, 2, 100);
const S2 = setText(subline, "BEAUTY WORLD", line2Size, track2, 2, 120);
const S = { width: stackW, height: 126 };

/* ---------------------------------------------------------------- files */
const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const NAME = "Queen Palace Beauty World";

const horizontal = (mark, text) => svg(H.width, H.height, `<path fill="${mark}" d="${monoPath}"/><path fill="${text}" d="${L1.d}"/><path fill="${mark}" d="${L2.d}"/>`, NAME);
const stacked = (mark, text) => svg(S.width, S.height, `<g transform="translate(${stackMarkX} 0)"><path fill="${mark}" d="${monoPath}"/></g><path fill="${text}" d="${S1.d}"/><path fill="${mark}" d="${S2.d}"/>`, NAME);
const monogram = (fill) => svg(64, 64, `<path fill="${fill}" d="${monoPath}"/>`, NAME);
const appIcon = (bg, fill, radius = 14) => svg(64, 64, `<rect width="64" height="64" rx="${radius}" fill="${bg}"/><g transform="translate(6.4 7.2) scale(.8)"><path fill="${fill}" d="${monoPath}"/></g>`, NAME);

const files = {
  "logo-horizontal-light.svg": horizontal(COLORS.goldDeep, COLORS.burgundy),
  "logo-horizontal-dark.svg": horizontal(COLORS.gold, COLORS.ivory),
  "logo-stacked-light.svg": stacked(COLORS.goldDeep, COLORS.burgundy),
  "logo-stacked-dark.svg": stacked(COLORS.gold, COLORS.ivory),
  "monogram-gold.svg": monogram(COLORS.gold),
  "monogram-burgundy.svg": monogram(COLORS.burgundy),
  "monogram-ivory.svg": monogram(COLORS.ivory),
  "app-icon.svg": appIcon(COLORS.burgundy, COLORS.gold),
  "app-icon-dark.svg": appIcon(COLORS.night, COLORS.gold),
};
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
writeFileSync(join(root, "src", "app", "icon.svg"), files["app-icon.svg"]);

/* ------------------------------------------------------ React path data */
const ts = `/* Generated by scripts/build-brand.mjs. Do not edit by hand. */
export const MONOGRAM_PATH = ${JSON.stringify(monoPath)};
export const HORIZONTAL = ${JSON.stringify({ width: H.width, height: H.height, line1: L1.d, line2: L2.d })};
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
await png("apple-touch-icon.png", `<div style="width:180px;height:180px;background:${COLORS.burgundy};display:grid;place-items:center">${img("monogram-gold.svg", 132, 132)}</div>`, 180, 180);
await png(
  "social-avatar.png",
  `<div style="width:1080px;height:1080px;background:radial-gradient(circle at 50% 40%,#7d1d3a,${COLORS.burgundy} 60%,#4c0f22);display:grid;place-items:center">
     <div style="width:720px;height:720px;border-radius:50%;border:6px solid ${COLORS.gold}55;display:grid;place-items:center">${img("monogram-gold.svg", 660, 660)}</div></div>`,
  1080,
  1080,
);
await png(
  "og-image.png",
  `<div style="width:1200px;height:630px;background:${COLORS.ivory};display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;font-family:Georgia,serif;position:relative;overflow:hidden">
     <div style="position:absolute;right:-120px;top:-120px;width:560px;height:560px;border-radius:50%;background:${COLORS.burgundy}"></div>
     <div style="position:absolute;right:40px;top:60px">${img("monogram-gold.svg", 260, 260)}</div>
     ${img("logo-horizontal-light.svg", Math.round(H.width * 6.2), Math.round(H.height * 6.2))}
     <div style="margin-top:36px;font-size:30px;color:${COLORS.charcoal};font-family:system-ui,sans-serif">Wigs, bone straight, braids and hair care · Ilesha, Osun State</div>
   </div>`,
  1200,
  630,
);
await browser.close();
writeFileSync(join(root, "src", "app", "apple-icon.png"), readFileSync(join(out, "apple-touch-icon.png")));
writeFileSync(join(root, "src", "app", "opengraph-image.png"), readFileSync(join(out, "og-image.png")));
console.log(`brand built: horizontal ${H.width}×${H.height}, stacked ${S.width}×${S.height}`);
