import type { Metadata } from "next";
import { CareTips, CollectionTiles, CtaBand, Editorial, Faq, Newsletter, ProductRail, Promises, Promo, ReviewsStrip, ShadeGuide, Testimonials } from "@/components/store/home/Sections";
import { LuxCollectionRail, LuxHero, LuxLooks, LuxMarquee, LuxStandard, LuxVisit } from "@/components/store/home/StaticHome";
import { VideoReels } from "@/components/store/home/VideoReels";
import { orderCollections } from "@/lib/collections";
import { getSettings, storefront } from "@/lib/data/storefront";
import { unstable_rethrow } from "next/navigation";
import type { Collection, CollectionWithProducts, Homepage } from "@/lib/types";

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
/** Published collections in the order set in admin. Failure just means placeholders show. */
async function collectionsOrEmpty(): Promise<Collection[]> {
  try {
    return orderCollections(await storefront().collections());
  } catch (err) {
    unstable_rethrow(err);
    console.error("[home] collections unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}
/** Products for the first two collections, shown as rows around the product videos. */
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
  const [home, settings, collections] = await Promise.all([homepageOrEmpty(), getSettings(), collectionsOrEmpty()]);
  const rails = await collectionRails(collections);
  const sections = home.sections.filter((s) => s.type !== "hero" && s.type !== "marquee");
  return (
    <>
      <LuxHero settings={settings} />
      <LuxMarquee />
      <LuxLooks collections={collections} />
      {/* The lead collection (Futura Wigs) comes before the videos; the next one after them. */}
      {rails.slice(0, 1).map((r) => (
        <LuxCollectionRail key={r.collection.id} data={r} />
      ))}
      <VideoReels />
      {rails.slice(1).map((r) => (
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
