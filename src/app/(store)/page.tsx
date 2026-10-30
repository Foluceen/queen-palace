import type { Metadata } from "next";
import { CareTips, CollectionTiles, CtaBand, Editorial, Faq, Newsletter, ProductRail, Promises, Promo, ReviewsStrip, ShadeGuide, Testimonials } from "@/components/store/home/Sections";
import { LuxArrivals, LuxCollectionRail, LuxHero, LuxLooks, LuxMarquee, LuxStandard, LuxVisit } from "@/components/store/home/StaticHome";
import { getSettings, storefront } from "@/lib/data/storefront";
import { unstable_rethrow } from "next/navigation";
import type { Collection, CollectionWithProducts, Homepage, ProductCard } from "@/lib/types";

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

/** Published collections in the order set in admin. Failure just means placeholders show. */
async function collectionsOrEmpty(): Promise<Collection[]> {
  try {
    const list = await storefront().collections();
    return list.filter((c) => c.status !== "draft" && c.status !== "archived").sort((a, b) => a.position - b.position);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[home] collections unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}
/** Products for the first two collections, shown as rows after "New in". */
async function collectionRails(collections: Collection[]): Promise<CollectionWithProducts[]> {
  const picks = collections.filter((c) => c.productCount > 0).slice(0, 2);
  const results = await Promise.all(
    picks.map(async (c) => {
      try {
        return await storefront().collection(c.handle, { page: 1, pageSize: 8 });
      } catch (err) {
        unstable_rethrow(err);
        console.error(`[home] collection ${c.handle} unavailable:`, err instanceof Error ? err.message : err);
        return null;
      }
    }),
  );
  return results.filter((r): r is CollectionWithProducts => !!r && r.listing.items.length > 0);
}

/**
 * The brand sections (hero, lookbook, standard, visit) are static and always render, so the
 * site works with an empty catalogue. Sections arranged in admin → Homepage are added below
 * the lookbook once they exist; until then, new arrivals or an honest "being added" panel.
 */
export default async function HomePage() {
  const [home, settings, arrivals, collections] = await Promise.all([homepageOrEmpty(), getSettings(), newArrivals(), collectionsOrEmpty()]);
  const rails = await collectionRails(collections);
  const town = /\b(Ilesha|Ilesa)\b/i.exec(settings.address)?.[0] ?? null;
  const sections = home.sections.filter((s) => s.type !== "hero" && s.type !== "marquee");
  return (
    <>
      <LuxHero settings={settings} />
      <LuxMarquee town={town} />
      <LuxLooks collections={collections} />
      {/* null = the product list couldn't be loaded (logged above): show nothing rather than "being added". */}
      {sections.length || arrivals === null ? null : <LuxArrivals products={arrivals} settings={settings} />}
      {rails.map((r) => (
        <LuxCollectionRail key={r.collection.id} data={r} />
      ))}
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
