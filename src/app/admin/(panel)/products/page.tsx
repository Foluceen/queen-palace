"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Can, RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { formatPriceRange } from "@/lib/format";
import type { PublishStatus } from "@/lib/types";

function ProductsInner() {
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
        description="Everything in your catalog, including drafts and archived items."
        actions={
          <Can permission="products:write">
            <Link href="/admin/products/new" className="btn">
              Add product
            </Link>
          </Can>
        }
      />
      <form
        className="afilters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
      >
        <input className="input" type="search" placeholder="Search by name, texture or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <select className="select" value={status} onChange={(e) => (setStatus(e.target.value as PublishStatus | ""), setPage(1))} aria-label="Status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className="select" value={collectionId} onChange={(e) => (setCollectionId(e.target.value), setPage(1))} aria-label="Collection">
          <option value="">All collections</option>
          <option value="none">No collection</option>
          {collections.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className="select" value={productTypeId} onChange={(e) => (setProductTypeId(e.target.value), setPage(1))} aria-label="Product type" disabled={!!types.error} title={types.error ? `Product types couldn't be loaded: ${types.error}` : undefined}>
          <option value="">{types.error ? "Types unavailable" : "All types"}</option>
          {(types.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--ghost">
          Search
        </button>
      </form>

      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.items.length ? (
          <>
            <div className={`atable-wrap ${loading ? "is-pending" : ""}`}>
              <table className="atable">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Status</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Collections</th>
                    <th scope="col" className="num">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => {
                    const stock = p.variants.reduce((s, v) => s + (v.inventory.tracked ? v.inventory.available : 0), 0);
                    const soldOut = p.variants.filter((v) => v.availability === "out_of_stock").length;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/admin/products/${p.id}`} className="atable__product">
                            {p.media[0] ? <Image src={p.media[0].url} alt="" width={40} height={50} /> : <span className="atable__noimg" />}
                            <span>
                              <span className="atable__primary">{p.title}</span>
                              <span className="small muted">{p.variants.length} variants</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <StatusBadge tone={p.status === "published" ? "success" : p.status === "draft" ? "warning" : "neutral"}>{p.status[0]!.toUpperCase() + p.status.slice(1)}</StatusBadge>
                        </td>
                        <td>
                          {stock} in stock
                          {soldOut ? <span className="small muted"> ({soldOut} sold out)</span> : null}
                        </td>
                        <td className="small">{p.collectionIds.map((id) => collections.data?.find((c) => c.id === id)?.title).filter(Boolean).join(", ") || <span className="muted">None</span>}</td>
                        <td className="num">{formatPriceRange(p.priceRange)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
          <Empty title={query || status || collectionId || productTypeId ? "No products match" : "No products yet"} body={query || status || collectionId || productTypeId ? "Try a different search or filter." : "Add your first product to start selling."} />
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
