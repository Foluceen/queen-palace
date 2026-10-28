// Builds the single-page preview (dist-preview/index.html + media/) that runs the real
// storefront and admin in a browser with the mock backend, for hosting as a static page.
//   npm run preview:build
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-preview");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const shim = (p) => join(root, "preview", "shims", p);
const aliases = {
  "next/link": shim("link.tsx"),
  "next/image": shim("image.tsx"),
  "next/navigation": shim("navigation.ts"),
  "next/dynamic": shim("dynamic.tsx"),
  "@/lib/api/browser": shim("api-browser.ts"),
};

const result = await build({
  entryPoints: [join(root, "preview", "main.tsx")],
  bundle: true,
  write: false,
  outdir: out,
  format: "iife",
  platform: "browser",
  target: ["es2020", "safari15"],
  minify: true,
  jsx: "automatic",
  tsconfig: join(root, "tsconfig.json"),
  loader: { ".woff2": "empty" },
  logLevel: "warning",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_DATA_MODE": '"mock"',
    "process.env.NEXT_PUBLIC_PREVIEW_BUNDLE": '"1"',
    "process.env.NEXT_PUBLIC_SITE_URL": '"https://preview.irun.example"',
    "process.env": "{}",
  },
  plugins: [
    {
      name: "next-shims",
      setup(b) {
        b.onResolve({ filter: /^(next\/(link|image|navigation|dynamic)|@\/lib\/api\/browser)$/ }, (args) => ({ path: aliases[args.path] }));
      },
    },
  ],
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;
const motion = readFileSync(join(root, "src/components/motion/MotionTierScript.tsx"), "utf8").match(/const script = `([^`]+)`/)[1];

const html = `<title>Ìrun Store Preview</title>
<meta name="description" content="Clickable preview of the Ìrun hair storefront and admin, running on demo data.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Manrope:wght@300..800&display=swap">
<script>${motion}</script>
<style>
:root{--font-bricolage:"Bricolage Grotesque";--font-bricolage-ext:"Bricolage Grotesque";--font-manrope:"Manrope";--font-manrope-ext:"Manrope";color-scheme:dark}
${css}
.site-header{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:60;background:var(--bg)}
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(join(out, "index.html"), html);
cpSync(join(root, "public", "media"), join(out, "media"), { recursive: true });
console.log(`preview built: index.html ${(html.length / 1024).toFixed(0)} KB`);
