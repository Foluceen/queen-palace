import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionSearch } from "@/components/store/listing/CollectionSearch";
import { ListingControls } from "@/components/store/listing/ListingControls";
import { Pagination } from "@/components/store/listing/Pagination";
import { ProductGrid } from "@/components/store/ProductCard";
import { getCollectionHead, storefront } from "@/lib/data/storefront";
import { first, flatParams, listingQuery, type RawSearchParams } from "@/lib/search-params";
import { displayName } from "@/lib/collections";

export const revalidate = 60;

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  const pageNo = Number(first(sp.page)) || 1;
  const data = await getCollectionHead(handle);
  if (!data) return { title: "Collection not found" };
  const c = data.collection;
  return {
    // Owner titles are often typed in capitals ("WIG TOOLS"): show them like the menu does.
    title: `${displayName(c.seo.title ?? c.title)}${pageNo > 1 ? ` – page ${pageNo}` : ""}`,
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
  const name = displayName(collection.title);
  const flat = flatParams(sp);
  const replayKey = JSON.stringify(flat);
  const hero = collection.banner ?? collection.image;
  const searching = Boolean(flat.q);

  return (
    <>
      <section className={`chead ${hero ? "chead--banner" : ""}`}>
        {hero ? (
          <div className="chead__banner">
            <Image quality={90} src={hero.url} alt={hero.alt} fill priority sizes="100vw" className="chead__img" />
            <span className="chead__shade" aria-hidden />
          </div>
        ) : null}
        <div className="container chead__text">
          <nav aria-label="Breadcrumb" className="crumbs small">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/collections">Collections</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{name}</span>
          </nav>
          <h1 className="chead__title display">{name}</h1>
          {collection.description ? <p className="lede chead__lede">{collection.description}</p> : null}
        </div>
      </section>

      <section className="container section--tight" aria-labelledby="col-products">
        <h2 id="col-products" className="sr-only">
          {name} products
        </h2>
        <Suspense>
          <CollectionSearch collectionTitle={name} />
        </Suspense>
        {searching ? (
          <p className="small muted csearch__summary" role="status">
            {listing.total} {listing.total === 1 ? "result" : "results"} for “{flat.q}” in {name}
          </p>
        ) : null}
        <Suspense>
          <ListingControls facets={listing.facets} total={listing.total}>
            {listing.items.length ? (
              <ProductGrid products={listing.items} replayKey={replayKey} priorityCount={2} />
            ) : (
              <div className="state">
                <h2 className="state__title">{searching ? `Nothing in ${name} matches “${flat.q}”` : listing.total === 0 && !Object.keys(flat).length ? "Nothing here yet" : "Nothing matches those filters"}</h2>
                <p className="muted">{!Object.keys(flat).length ? "New styles are on the way. Browse our other collections meanwhile." : searching ? "Try another word, or search the whole store." : `Remove a filter to see more styles in ${name}.`}</p>
                <div className="cluster">
                  {Object.keys(flat).length ? (
                    <Link href={`/collections/${collection.handle}`} className="btn">
                      Clear {searching ? "search" : "filters"}
                    </Link>
                  ) : (
                    <Link href="/collections" className="btn">
                      All collections
                    </Link>
                  )}
                  {searching ? (
                    <Link href={`/search?q=${encodeURIComponent(flat.q!)}`} className="btn btn--ghost">
                      Search everything
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
            <Pagination page={listing.page} totalPages={listing.totalPages} basePath={`/collections/${collection.handle}`} params={flat} />
          </ListingControls>
        </Suspense>
      </section>
    </>
  );
}
