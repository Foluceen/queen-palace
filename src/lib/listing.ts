import type { ProductListing, ProductQuery } from "@/lib/types";

/**
 * The live API's collection endpoint returns every product in the collection at once and ignores
 * sort, page and search. When that happens (more items than one page), the storefront sorts,
 * filters and pages the list itself so collection pages behave like the rest of the shop.
 * A backend that pages correctly returns at most one page and is passed through untouched.
 */
export function pageLocally(listing: ProductListing, query: Pick<ProductQuery, "sort" | "page" | "pageSize" | "q" | "inStock">): ProductListing {
  const size = query.pageSize ?? 15;
  const q = query.q?.trim().toLowerCase();
  const backendPaged = listing.items.length <= size && !(q || query.inStock);
  if (backendPaged) return listing;
  let items = [...listing.items];
  if (q) items = items.filter((p) => `${p.title} ${p.subtitle}`.toLowerCase().includes(q));
  if (query.inStock) items = items.filter((p) => p.availability !== "out_of_stock");
  const time = (s?: string) => (s ? Date.parse(s) || 0 : 0);
  switch (query.sort) {
    case "newest":
      items.sort((a, b) => time(b.createdAt) - time(a.createdAt));
      break;
    case "price_asc":
      items.sort((a, b) => a.priceRange.min - b.priceRange.min);
      break;
    case "price_desc":
      items.sort((a, b) => b.priceRange.max - a.priceRange.max);
      break;
    case "rating":
      items.sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count);
      break;
    default:
      break;
  }
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, query.page ?? 1), totalPages);
  return { ...listing, items: items.slice((page - 1) * size, page * size), page, pageSize: size, total, totalPages };
}
