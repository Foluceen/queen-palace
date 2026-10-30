import type { Collection } from "@/lib/types";

/**
 * Collections that lead the storefront: shown first in "Shop by collection", get their product
 * row before "New in", and get their own link in the main menu. Everything else follows the
 * order set in Admin → Collections.
 */
export const LEAD_COLLECTIONS = ["futura-wigs"];

/** "WIG TOOLS" -> "Wig Tools": all-caps titles read badly in the script font and menus. */
export function displayName(title: string): string {
  const t = title.trim();
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()) : t;
}

/** Published collections, lead collections first, then admin order. */
export function orderCollections(list: Collection[]): Collection[] {
  const lead = (c: Collection) => {
    const i = LEAD_COLLECTIONS.indexOf(c.handle);
    return i < 0 ? LEAD_COLLECTIONS.length : i;
  };
  return list.filter((c) => c.status !== "draft" && c.status !== "archived").sort((a, b) => lead(a) - lead(b) || a.position - b.position);
}
