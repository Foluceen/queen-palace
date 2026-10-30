import { displayName } from "@/lib/collections";
import type { Collection, Navigation } from "@/lib/types";

/**
 * Until menus are arranged in Admin → Menus, the header and footer are built from the store's
 * live collections (lead collection first) plus pages that always exist. As soon as the API
 * returns a menu, it is used instead.
 */
export function storeNavigation(nav: Navigation, collections: Collection[]): Navigation {
  const cols = collections.filter((c) => c.productCount > 0 || collections.length <= 4);
  const link = (c: Collection) => ({ id: `nav-c-${c.handle}`, label: displayName(c.title), href: `/collections/${c.handle}` });
  return {
    main: nav.main.length
      ? nav.main
      : [
          {
            id: "nav-shop",
            label: "Shop",
            href: "/search",
            children: [
              { id: "nav-all", label: "Shop everything", href: "/search" },
              { id: "nav-new-c", label: "New in", href: "/search?sort=newest" },
              ...cols.map(link),
              { id: "nav-collections", label: "All collections", href: "/collections" },
            ],
          },
          // The first two collections get their own place in the menu.
          ...cols.slice(0, 2).map(link),
          { id: "nav-new", label: "New in", href: "/search?sort=newest" },
          { id: "nav-track", label: "Track order", href: "/track" },
          { id: "nav-contact", label: "Contact", href: "/contact" },
        ],
    footer: nav.footer.length
      ? nav.footer
      : [
          {
            id: "foot-shop",
            title: "Shop",
            items: [
              ...cols.slice(0, 4).map((c) => ({ ...link(c), id: `f-c-${c.handle}` })),
              { id: "f-new", label: "New in", href: "/search?sort=newest" },
              { id: "f-all", label: "All collections", href: "/collections" },
              { id: "f-wish", label: "Wishlist", href: "/wishlist" },
            ],
          },
          {
            id: "foot-help",
            title: "Help",
            items: [
              { id: "f-track", label: "Track an order", href: "/track" },
              { id: "f-account", label: "My account", href: "/account" },
              { id: "f-search", label: "Search", href: "/search" },
              { id: "f-contact", label: "Contact us", href: "/contact" },
            ],
          },
        ],
  };
}
