import type { NextConfig } from "next";

/**
 * Remote image hosts are read from NEXT_PUBLIC_MEDIA_HOSTS (comma separated),
 * so the live backend's CDN can be allowed without a code change.
 */
const mediaHosts = Array.from(
  new Set([
    // Production media is served by the API (https://api.queenluxuryhair.store/v1/media/:id).
    "api.queenluxuryhair.store",
    ...(process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  ]),
);

// In live mode, images served by the API host itself are allowed too.
if (process.env.NEXT_PUBLIC_DATA_MODE === "live" && process.env.NEXT_PUBLIC_API_BASE_URL) {
  try {
    const apiHost = new URL(process.env.NEXT_PUBLIC_API_BASE_URL).hostname;
    if (!mediaHosts.includes(apiHost)) mediaHosts.push(apiHost);
  } catch {
    /* invalid URL: the client reports it at runtime */
  }
}

/**
 * Old domains that should land on the canonical one, keeping the path. These only take effect if
 * the old domain is attached to the same Vercel project; otherwise Vercel answers before Next does.
 * Do not add www.queenluxuryhair.store here: the www/apex redirect is set in Vercel's Domains
 * settings, and doing it in both places can loop.
 */
const LEGACY_HOSTS = ["queenpalacebeauty.store", "www.queenpalacebeauty.store"];
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/** Registrable domain, good enough for the .store / .com / .com.ng hosts this project uses. */
function siteOf(host: string): string {
  const parts = host.split(".");
  const take = /^(com|net|org|gov|edu)\.[a-z]{2}$/.test(parts.slice(-2).join(".")) ? 3 : 2;
  return parts.slice(-take).join(".");
}

// Session cookies are SameSite=Lax, so the browser only sends them to an API on the same site as
// the storefront. A cross-site API breaks sign-in, the bag and checkout. Warn at build time.
if (process.env.NEXT_PUBLIC_DATA_MODE === "live" && siteUrl && process.env.NEXT_PUBLIC_API_BASE_URL) {
  try {
    const site = siteOf(new URL(siteUrl).hostname);
    const api = siteOf(new URL(process.env.NEXT_PUBLIC_API_BASE_URL).hostname);
    if (site !== api && !process.env.QLH_CROSS_SITE_WARNED) {
      process.env.QLH_CROSS_SITE_WARNED = "1"; // build workers inherit this, so it prints once
      console.warn(
        `\n[config] NEXT_PUBLIC_API_BASE_URL is on ${api} but NEXT_PUBLIC_SITE_URL is on ${site}. ` +
          "Customer and staff session cookies will not reach a cross-site API. Point the API at a host under " +
          `${site} once the backend confirms it (see docs/LIVE_READINESS.md, "Domain change").\n`,
      );
    }
  } catch {
    /* invalid URL: the client reports it at runtime */
  }
}

/**
 * Security headers for every page. The CSP allows inline scripts because Next's App Router
 * bootstraps with inline scripts (a nonce-based CSP would force every page to be dynamic);
 * it still blocks third-party scripts, plugins, framing and form posts elsewhere.
 */
function apiOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_API_BASE_URL ? new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin : null;
  } catch {
    return null;
  }
}
const imageSources = ["'self'", "data:", "blob:", ...mediaHosts.map((h) => `https://${h}`)];
const connectSources = ["'self'", ...(apiOrigin() ? [apiOrigin() as string] : [])];
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imageSources.join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "media-src 'self' https: blob:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Put metadata in <head> for crawlers and link-preview bots (WhatsApp sharing matters here).
  htmlLimitedBots: /Googlebot|Bingbot|DuckDuckBot|YandexBot|Baiduspider|Chrome-Lighthouse|facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|Applebot/i,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 200, 320, 480],
    qualities: [62, 65, 75],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: mediaHosts.map((hostname) => ({ protocol: "https", hostname })),
  },
  experimental: {
    optimizePackageImports: ["animejs"],
  },
  async redirects() {
    if (!siteUrl) return [];
    return LEGACY_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${siteUrl}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      // Dev server needs eval for fast refresh; production builds (including the mock demo) get the full set.
      ...(process.env.NODE_ENV === "production" ? [{ source: "/:path*", headers: securityHeaders }] : []),
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
