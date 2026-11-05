import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/api/config";
import { storefront } from "@/lib/data/storefront";

/** Rebuilt at most hourly. If the API is down, the static pages are still listed. */
export const revalidate = 3600;

const STATIC_PAGES = ["", "/collections", "/search", "/contact", "/track", "/about", "/faq", "/hair-care", "/shipping", "/returns", "/privacy", "/terms"];

async function allProductHandles(): Promise<{ handle: string; createdAt?: string }[]> {
  const out: { handle: string; createdAt?: string }[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const listing = await storefront().products({ page, pageSize: 100 });
      out.push(...listing.items.map((p) => ({ handle: p.handle, createdAt: p.createdAt })));
      if (page >= listing.totalPages || !listing.items.length) break;
    }
  } catch (err) {
    console.error("[sitemap] products unavailable:", err instanceof Error ? err.message : err);
  }
  return [...new Map(out.map((p) => [p.handle, p])).values()];
}

async function collectionHandles(): Promise<string[]> {
  try {
    return (await storefront().collections()).filter((c) => c.status !== "draft" && c.status !== "archived").map((c) => c.handle);
  } catch (err) {
    console.error("[sitemap] collections unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([allProductHandles(), collectionHandles()]);
  return [
    ...STATIC_PAGES.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.5 })),
    ...collections.map((h) => ({ url: `${siteUrl}/collections/${h}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${siteUrl}/products/${p.handle}`, lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
