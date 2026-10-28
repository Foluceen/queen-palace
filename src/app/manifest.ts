import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/data/storefront";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: s.name,
    short_name: "Queen Palace",
    description: s.metaDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: "#6b1630",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
