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
const fraunces = localFont({
  src: [{ path: "./fonts/fraunces-latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
});
const frauncesExt = localFont({
  src: [{ path: "./fonts/fraunces-latin-ext.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-fraunces-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: [],
});

/**
 * The root layout must render even when the API is down (admin sign-in, error pages), so it
 * never throws on a settings failure. It falls back only to the store's name, which is a fixed
 * brand fact, and to "match device" for the theme. No catalog or business data is substituted:
 * the storefront layout below still fails and shows its unavailable state.
 */
const BRAND_NAME = "Queen Palace Beauty World";
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
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0b0c" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await settingsOrNull();
  return (
    <html lang="en-NG" className={`${manrope.variable} ${manropeExt.variable} ${fraunces.variable} ${frauncesExt.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(settings?.theme?.defaultMode ?? "system") }} />
        <MotionTierScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
