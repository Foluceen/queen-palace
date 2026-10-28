import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyStateStatic } from "@/components/ui/StaticStates";
import { storefront } from "@/lib/data/storefront";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All collections",
  description: "Bone straight, Futura wigs, factory wigs, braid extensions and hair care.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const collections = await storefront().collections();
  return (
    <div className="container section--tight">
      <header className="page-head">
        <h1 className="h1">All collections</h1>
        <p className="lede">Every texture we carry, from ready-to-wear units to the care that keeps them new.</p>
      </header>
      {collections.length === 0 ? (
        <EmptyStateStatic title="No collections yet" body="Check back soon, new hair is on the way." />
      ) : (
        <ol className="clist">
          {collections.map((c, i) => (
            <li key={c.id} className="clist__item">
              <Link href={`/collections/${c.handle}`} className="clist__link">
                <Reveal className="clist__media" variant="fall">
                  <div className="clist__frame">
                    {c.image ? <Image src={c.image.url} alt={c.image.alt} fill sizes="(min-width: 900px) 30vw, 100vw" priority={i < 2} className="clist__img" /> : null}
                  </div>
                </Reveal>
                <div className="clist__text">
                  <h2 className="clist__title display">{c.title}</h2>
                  <p className="lede">{c.summary}</p>
                  <p className="small muted">
                    {c.productCount} {c.productCount === 1 ? "style" : "styles"}
                  </p>
                  <span className="btn btn--ghost btn--sm clist__cta">Shop {c.title}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
