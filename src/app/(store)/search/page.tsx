import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingControls } from "@/components/store/listing/ListingControls";
import { ProductGrid } from "@/components/store/ProductCard";
import { storefront } from "@/lib/data/storefront";
import { first, listingQuery, type RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim();
  const query = listingQuery(sp);
  // With no term, show the full catalog so "Shop all" and sort links still work.
  const result = q ? await storefront().search(q, query.page) : null;
  const listing = result ? result.products : await storefront().products({ ...query, pageSize: 24 });

  return (
    <div className="container section--tight">
      <header className="page-head">
        <h1 className="h1">{q ? `Results for “${q}”` : "Shop everything"}</h1>
        <form action="/search" role="search" className="search-page__form">
          <label htmlFor="search-page-q" className="sr-only">
            Search
          </label>
          <input id="search-page-q" name="q" defaultValue={q} className="input" placeholder="Search lengths, textures, shades" enterKeyHint="search" />
          <button type="submit" className="btn">
            Search
          </button>
        </form>
      </header>

      {result?.collections.length ? (
        <div className="cluster search-page__collections">
          <span className="small muted">Collections</span>
          {result.collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.handle}`} className="chip">
              {c.title}
            </Link>
          ))}
        </div>
      ) : null}

      <Suspense>
        <h2 className="sr-only">Products</h2>
        <ListingControls facets={q ? [] : listing.facets} total={listing.total}>
          {listing.items.length ? (
            <ProductGrid products={listing.items} replayKey={JSON.stringify(sp)} priorityCount={2} />
          ) : (
            <div className="state">
              <h2 className="state__title">No matches for “{q}”</h2>
              <p className="muted">Try a length like 16&quot;, a shade code like 613, or a texture like bone straight.</p>
              <div className="cluster">
                {(result?.suggestions ?? []).map((s) => (
                  <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </ListingControls>
      </Suspense>
    </div>
  );
}
