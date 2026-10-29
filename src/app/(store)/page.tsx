import type { Metadata } from "next";
import { CareTips, CollectionTiles, CtaBand, Editorial, Faq, Newsletter, ProductRail, Promises, Promo, ReviewsStrip, ShadeGuide, Testimonials } from "@/components/store/home/Sections";
import { LuxArrivals, LuxHero, LuxLooks, LuxMarquee, LuxStandard, LuxVisit } from "@/components/store/home/StaticHome";
import { getSettings, storefront } from "@/lib/data/storefront";
import { unstable_rethrow } from "next/navigation";
import type { Homepage, ProductCard } from "@/lib/types";

export const revalidate = 60;

// Canonical is the bare domain (NEXT_PUBLIC_SITE_URL), so www and legacy hosts consolidate here.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Homepage sections and new arrivals are optional: their failure never takes the home page down. */
async function homepageOrEmpty(): Promise<Homepage> {
  try {
    return await storefront().homepage();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[home] homepage sections unavailable:", err instanceof Error ? err.message : err);
    return { sections: [], collections: [] } as unknown as Homepage;
  }
}
async function newArrivals(): Promise<ProductCard[] | null> {
  try {
    const listing = await storefront().products({ sort: "newest", page: 1, pageSize: 8 });
    return listing.items;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[home] products unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The brand sections (hero, lookbook, standard, visit) are static and always render, so the
 * site works with an empty catalogue. Sections arranged in admin → Homepage are added below
 * the lookbook once they exist; until then, new arrivals or an honest "being added" panel.
 */
export default async function HomePage() {
  const [home, settings, arrivals] = await Promise.all([homepageOrEmpty(), getSettings(), newArrivals()]);
  const town = /\b(Ilesha|Ilesa)\b/i.exec(settings.address)?.[0] ?? null;
  const sections = home.sections.filter((s) => s.type !== "hero" && s.type !== "marquee");
  return (
    <>
      <LuxHero settings={settings} />
      <LuxMarquee town={town} />
      <LuxLooks />
      {sections.length ? null : <LuxArrivals products={arrivals} settings={settings} />}
      {sections.map((s) => {
        switch (s.type) {
          case "collections":
            return <CollectionTiles key={s.id} section={s} collections={home.collections} />;
          case "product_rail":
            return <ProductRail key={s.id} section={s} />;
          case "editorial":
            return <Editorial key={s.id} section={s} />;
          case "shade_guide":
            return <ShadeGuide key={s.id} section={s} />;
          case "reviews":
            return <ReviewsStrip key={s.id} section={s} />;
          case "promises":
            return <Promises key={s.id} section={s} />;
          case "cta_band":
            return <CtaBand key={s.id} section={s} settings={settings} />;
          case "promo":
            return <Promo key={s.id} section={s} />;
          case "testimonials":
            return <Testimonials key={s.id} section={s} />;
          case "care_tips":
            return <CareTips key={s.id} section={s} />;
          case "faq":
            return <Faq key={s.id} section={s} />;
          case "newsletter":
            return <Newsletter key={s.id} section={s} />;
          default:
            return null;
        }
      })}
      {sections.length ? null : <LuxStandard />}
      <LuxVisit settings={settings} />
    </>
  );
}
