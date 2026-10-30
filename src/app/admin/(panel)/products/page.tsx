"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Can, RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { formatPriceRange } from "@/lib/format";
import type { PublishStatus } from "@/lib/types";

function ProductsInner() {
  const { can } = useAdmin();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PublishStatus | "">("");
  const sp = useSearchParams();
  const [collectionId, setCollectionId] = useState(sp.get("collection") ?? "");
  const [productTypeId, setProductTypeId] = useState("");
  const types = useResource(() => api().call("adminListProductTypes"));
  const [page, setPage] = useState(1);
  const collections = useResource(() => api().call("adminListCollections"));
  const { data, error, loading, reload } = useResource(() => api().call("adminListProducts", { query: { q: query || undefined, status: status || undefined, collectionId: collectionId || undefined, productTypeId: productTypeId || undefined, page, pageSize: 20 } }), [query, status, collectionId, productTypeId, page]);

  return (
    <RequirePermission permission="products:read">
      <PageHeader
        title="Products"
        description="Everything you sell. Tap a product to change its photos, price or stock."
        actions={
          <Can permission="products:write">
            <Link href="/admin/products/new" className="btn">
              <Icon name="plus" size={18} /> Add a product
            </Link>
          </Can>
        }
      />
      <form
        className="afilters afilters--simple"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
      >
        <input className="input" type="search" placeholder="Search your products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <button type="submit" className="btn btn--ghost">
          Search
        </button>
      </form>
      <div className="achips" role="group" aria-label="Show">
        {([
          ["", "All"],
          ["published", "Showing in shop"],
          ["draft", "Hidden"],
          ["archived", "Archived"],
        ] as const).map(([v, label]) => (
          <button key={v || "all"} type="button" className={`achip ${status === v ? "is-on" : ""}`} aria-pressed={status === v} onClick={() => (setStatus(v as PublishStatus | ""), setPage(1))}>
            {label}
          </button>
        ))}
        <details className="achips__more">
          <summary className="achip">More filters</summary>
          <div className="achips__panel">
            <select className="select" value={collectionId} onChange={(e) => (setCollectionId(e.target.value), setPage(1))} aria-label="Collection">
              <option value="">All collections</option>
              <option value="none">Not in a collection</option>
              {collections.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select className="select" value={productTypeId} onChange={(e) => (setProductTypeId(e.target.value), setPage(1))} aria-label="Product type" disabled={!!types.error} title={types.error ? `Product types couldn't be loaded: ${types.error}` : undefined}>
              <option value="">{types.error ? "Types unavailable" : "All product types"}</option>
              {(types.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </details>
      </div>

      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.items.length ? (
          <>
            <ul className={`aplist ${loading ? "is-pending" : ""}`}>
              {data.items.map((p) => {
                const stock = p.variants.reduce((n, v) => n + (v.inventory.tracked ? v.inventory.available : 0), 0);
                const label = p.status === "published" ? "Showing" : p.status === "draft" ? "Hidden" : "Archived";
                return (
                  <li key={p.id}>
                    <Link href={`/admin/products/${p.id}`} className="aplist__row">
                      {p.media[0] ? <Image src={p.media[0].url} alt="" width={64} height={80} className="aplist__img" /> : <span className="aplist__img aplist__img--empty" aria-hidden><Icon name="image" size={20} /></span>}
                      <span className="aplist__text">
                        <span className="aplist__title">{p.title}</span>
                        <span className="aplist__meta">
                          <span className="aplist__price">{formatPriceRange(p.priceRange)}</span>
                          <span className={stock <= 0 ? "aplist__stock is-out" : "aplist__stock"}>{stock <= 0 ? "Sold out" : `${stock} in stock`}</span>
                        </span>
                      </span>
                      <StatusBadge tone={p.status === "published" ? "success" : p.status === "draft" ? "warning" : "neutral"}>{label}</StatusBadge>
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {data.totalPages > 1 ? (
              <div className="apager">
                <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="small muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty
            title={query || status || collectionId || productTypeId ? "No products match" : "No products yet"}
            body={query || status || collectionId || productTypeId ? "Try a different search, or tap “All”." : "Add your first product to start selling. It only takes photos, a name and a price."}
            action={!(query || status || collectionId || productTypeId) && can("products:write") ? <Link href="/admin/products/new" className="btn">Add a product</Link> : undefined}
          />
        )
      ) : null}
    </RequirePermission>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
