import { ModeBanner } from "@/components/ModeBanner";
import { BrandStyle } from "@/components/store/BrandStyle";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { FloatingWhatsApp } from "@/components/store/FloatingWhatsApp";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { WishlistProvider } from "@/components/store/WishlistProvider";
import { unstable_rethrow } from "next/navigation";
import { orderCollections } from "@/lib/collections";
import { storeNavigation } from "@/lib/navigation";
import { getNavigation, getSettings, storefront } from "@/lib/data/storefront";
import type { Collection } from "@/lib/types";
import "./store.css";

/** Menus never take the layout down: without collections the menu just has fewer links. */
async function navCollections(): Promise<Collection[]> {
  try {
    return orderCollections(await storefront().collections());
  } catch (err) {
    unstable_rethrow(err);
    return [];
  }
}

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, rawNavigation, collections] = await Promise.all([getSettings(), getNavigation(), navCollections()]);
  const navigation = storeNavigation(rawNavigation, collections);
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
