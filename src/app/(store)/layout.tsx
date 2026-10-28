import { ModeBanner } from "@/components/ModeBanner";
import { BrandStyle } from "@/components/store/BrandStyle";
import { CartDrawer } from "@/components/store/cart/CartDrawer";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { FloatingWhatsApp } from "@/components/store/FloatingWhatsApp";
import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { WishlistProvider } from "@/components/store/WishlistProvider";
import { getNavigation, getSettings } from "@/lib/data/storefront";
import "./store.css";

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation] = await Promise.all([getSettings(), getNavigation()]);
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
