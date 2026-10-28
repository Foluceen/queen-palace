import { decodeOptions } from "@/lib/api/contract";
import type { ProductQuery, ProductSort } from "@/lib/types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const sorts: ProductSort[] = ["featured", "best_selling", "newest", "price_asc", "price_desc", "rating"];

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Converts URL search params into a typed listing query for the repository. */
export function listingQuery(sp: RawSearchParams): Omit<ProductQuery, "collection"> {
  const sort = first(sp.sort) as ProductSort | undefined;
  const page = Number(first(sp.page) ?? 1);
  const q = first(sp.q)?.trim();
  return {
    q: q || undefined,
    sort: sort && sorts.includes(sort) ? sort : undefined,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: 12,
    options: decodeOptions(first(sp.options)),
    inStock: first(sp.inStock) === "1" || undefined,
  };
}

export function flatParams(sp: RawSearchParams): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, first(v)]));
}
