import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/api/config";

/** Static, so crawlers get an answer even while the API is unavailable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/order", "/api/"] }],
    host: siteUrl,
  };
}
