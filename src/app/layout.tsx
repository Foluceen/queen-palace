import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { unstable_rethrow } from "next/navigation";
import { MotionTierScript } from "@/components/motion/MotionTierScript";
import { siteUrl } from "@/lib/api/config";
import { getSettings } from "@/lib/data/storefront";
import { themeScript } from "@/lib/theme";
import "./globals.css";

/* Self-hosted variable fonts (copied from @fontsource by scripts/copy-fonts.mjs).
   Latin is preloaded; latin-ext files (which hold ₦) load only when a glyph needs them. */
const manrope = localFont({
  src: [{ path: "./fonts/manrope-latin.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-manrope",
  display: "swap",
  preload: true,
});
const manropeExt = localFont({
  src: [{ path: "./fonts/manrope-latin-ext.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-manrope-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: [],
});
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-latin.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-latin-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
});
const cormorantExt = localFont({
  src: [{ path: "./fonts/cormorant-latin-ext.woff2", weight: "300 700", style: "normal" }],
  variable: "--font-cormorant-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: [],
});
/* Script face for the wordmark and category labels only. */
const greatVibes = localFont({
  src: [{ path: "./fonts/great-vibes-latin.woff2", weight: "400", style: "normal" }],
  variable: "--font-script-face",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["cursive"],
});

/**
 * The root layout must render even when the API is down (admin sign-in, error pages), so it
 * never throws on a settings failure. It falls back only to the store's name, which is a fixed
 * brand fact, and to "match device" for the theme. No catalog or business data is substituted:
 * the storefront layout below still fails and shows its unavailable state.
 */
const BRAND_NAME = "Queen Luxury Hair";
async function settingsOrNull() {
  try {
    return await getSettings();
  } catch (err) {
    // Let Next's own control-flow signals (dynamic rendering, redirects) through untouched.
    unstable_rethrow(err);
    console.error("[layout] store settings unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await settingsOrNull();
  const name = s?.name ?? BRAND_NAME;
  return {
    metadataBase: new URL(siteUrl),
    title: s ? { default: `${s.name}: ${s.tagline}`, template: `%s | ${s.name}` } : { default: name, template: `%s | ${name}` },
    description: s?.metaDescription,
    applicationName: name,
    openGraph: { type: "website", locale: "en_NG", siteName: name },
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-icon.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#050505" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await settingsOrNull();
  return (
    <html lang="en-NG" className={`${manrope.variable} ${manropeExt.variable} ${cormorant.variable} ${cormorantExt.variable} ${greatVibes.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(settings?.theme?.defaultMode ?? "system") }} />
        <MotionTierScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
