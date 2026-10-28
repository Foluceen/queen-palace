import { CollectionTiles, CtaBand, Editorial, Hero, MarqueeBand, ProductRail, Promises, ReviewsStrip, ShadeGuide } from "@/components/store/home/Sections";
import { getSettings, storefront } from "@/lib/data/storefront";

export const revalidate = 60;

/** Homepage is fully driven by sections the vendor arranges in admin → Homepage and menus. */
export default async function HomePage() {
  const [home, settings] = await Promise.all([storefront().homepage(), getSettings()]);
  return (
    <>
      {home.sections.map((s) => {
        switch (s.type) {
          case "hero":
            return <Hero key={s.id} section={s} />;
          case "marquee":
            return <MarqueeBand key={s.id} section={s} />;
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
          default:
            return null;
        }
      })}
    </>
  );
}
