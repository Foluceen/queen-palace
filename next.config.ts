import type { NextConfig } from "next";

/**
 * Remote image hosts are read from NEXT_PUBLIC_MEDIA_HOSTS (comma separated),
 * so the live backend's CDN can be allowed without a code change.
 */
const mediaHosts = (process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

// In live mode, images served by the API host itself are allowed too.
if (process.env.NEXT_PUBLIC_DATA_MODE === "live" && process.env.NEXT_PUBLIC_API_BASE_URL) {
  try {
    const apiHost = new URL(process.env.NEXT_PUBLIC_API_BASE_URL).hostname;
    if (!mediaHosts.includes(apiHost)) mediaHosts.push(apiHost);
  } catch {
    /* invalid URL: the client reports it at runtime */
  }
}

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
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
