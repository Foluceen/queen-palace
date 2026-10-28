import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${s.name}: ${s.tagline}`, template: `%s | ${s.name}` },
    description: s.metaDescription,
    applicationName: s.name,
    openGraph: { type: "website", locale: "en_NG", siteName: s.name },
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
  const settings = await getSettings();
  return (
    <html lang="en-NG" className={`${manrope.variable} ${manropeExt.variable} ${fraunces.variable} ${frauncesExt.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript(settings.theme.defaultMode) }} />
        <MotionTierScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
