import { ModeBanner } from "@/components/ModeBanner";
import { BrandStyle } from "@/components/store/BrandStyle";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { FloatingWhatsApp } from "@/components/store/FloatingWhatsApp";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { WishlistProvider } from "@/components/store/WishlistProvider";
import { getNavigation, getSettings } from "@/lib/data/storefront";
import type { Navigation } from "@/lib/types";
import "./store.css";

/**
 * Until menus are arranged in admin, the header and footer link to pages that always exist.
 * As soon as the API returns a menu, it is used instead.
 */
function withFallbackNavigation(nav: Navigation): Navigation {
  return {
    main: nav.main.length
      ? nav.main
      : [
          { id: "nav-shop", label: "Shop", href: "/collections" },
          { id: "nav-looks", label: "Lookbook", href: "/#looks" },
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
              { id: "f-all", label: "All collections", href: "/collections" },
              { id: "f-search", label: "Search", href: "/search" },
              { id: "f-wish", label: "Wishlist", href: "/wishlist" },
            ],
          },
          {
            id: "foot-help",
            title: "Help",
            items: [
              { id: "f-track", label: "Track an order", href: "/track" },
              { id: "f-account", label: "My account", href: "/account" },
              { id: "f-contact", label: "Contact us", href: "/contact" },
            ],
          },
        ],
  };
}

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, rawNavigation] = await Promise.all([getSettings(), getNavigation()]);
  const navigation = withFallbackNavigation(rawNavigation);
  return (
    <CartProvider>
      <WishlistProvider>
        <BrandStyle settings={settings} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <ModeBanner />
        <Header settings={settings} navigation={navigation} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer settings={settings} navigation={navigation} />
        <FloatingWhatsApp settings={settings} />
        <CartDrawer />
      </WishlistProvider>
    </CartProvider>
  );
}
