import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionTierScript } from "@/components/motion/MotionTierScript";
import { siteUrl } from "@/lib/api/config";
import "./globals.css";

/* Self-hosted variable fonts (copied from @fontsource by scripts/copy-fonts.mjs).
   Latin is preloaded; the latin-ext files (which hold ₦) load only when a glyph needs them. */
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
const bricolage = localFont({
  src: [{ path: "./fonts/bricolage-latin.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-bricolage",
  display: "swap",
  preload: true,
});
const bricolageExt = localFont({
  src: [{ path: "./fonts/bricolage-latin-ext.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-bricolage-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: [],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Ìrun — Luxury hair, delivered across Nigeria", template: "%s | Ìrun" },
  description: "Double-drawn bone straight, Futura wigs, factory wigs, braiding hair and care essentials. Same-day dispatch in Lagos.",
  openGraph: { type: "website", locale: "en_NG", siteName: "Ìrun" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0709",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${manrope.variable} ${manropeExt.variable} ${bricolage.variable} ${bricolageExt.variable}`} suppressHydrationWarning>
      <head>
        <MotionTierScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
