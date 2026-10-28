import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { ListingControls } from "@/components/store/listing/ListingControls";
import { Pagination } from "@/components/store/listing/Pagination";
import { ProductGrid } from "@/components/store/ProductCard";
import { getCollectionHead, storefront } from "@/lib/data/storefront";
import { flatParams, listingQuery, type RawSearchParams } from "@/lib/search-params";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await getCollectionHead(handle);
  if (!data) return { title: "Collection not found" };
  const c = data.collection;
  return {
    title: c.seo.title ?? c.title,
    description: c.seo.description ?? c.summary,
    alternates: { canonical: `/collections/${c.handle}` },
    openGraph: c.image ? { images: [{ url: c.image.url, width: c.image.width, height: c.image.height, alt: c.image.alt }] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  const data = await storefront().collection(handle, listingQuery(sp));
  if (!data) notFound();
  const { collection, listing } = data;
  const flat = flatParams(sp);
  const replayKey = JSON.stringify(flat);

  return (
    <>
      <section className="chead">
        <div className="container chead__grid">
          <div className="chead__text">
            <nav aria-label="Breadcrumb" className="crumbs small">
              <Link href="/collections">Collections</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{collection.title}</span>
            </nav>
            <h1 className="chead__title display">{collection.title}</h1>
            <p className="lede">{collection.description}</p>
          </div>
          {collection.image ? (
            <Reveal className="chead__media" variant="fall">
              <div className="chead__frame">
                <Image src={collection.image.url} alt={collection.image.alt} fill priority sizes="(min-width: 900px) 34vw, 100vw" className="chead__img" />
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="container section--tight" aria-label={`${collection.title} products`}>
        <Suspense>
          <ListingControls facets={listing.facets} total={listing.total}>
            {listing.items.length ? (
              <ProductGrid products={listing.items} replayKey={replayKey} priorityCount={2} />
            ) : (
              <div className="state">
                <h2 className="state__title">Nothing matches those filters</h2>
                <p className="muted">Remove a filter to see more styles in {collection.title}.</p>
                <Link href={`/collections/${collection.handle}`} className="btn">
                  Clear filters
                </Link>
              </div>
            )}
            <Pagination page={listing.page} totalPages={listing.totalPages} basePath={`/collections/${collection.handle}`} params={flat} />
          </ListingControls>
        </Suspense>
      </section>
    </>
  );
}
