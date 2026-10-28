"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { Empty, LoadError, LoadingRows, PageHeader } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { formatDateTime, formatNaira, fulfillmentStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@/lib/format";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/types";

function Orders() {
  const sp = useSearchParams();
  const router = useRouter();
  const paymentStatus = (sp.get("paymentStatus") as PaymentStatus) || undefined;
  const fulfillmentStatus = (sp.get("fulfillmentStatus") as FulfillmentStatus) || undefined;
  const query = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(query);
  const { data, error, loading, reload } = useResource(() => api().call("adminListOrders", { query: { q: query || undefined, paymentStatus, fulfillmentStatus, page, pageSize: 20 } }), [query, paymentStatus, fulfillmentStatus, page]);

  const setParam = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    router.replace(`/admin/orders?${next.toString()}`);
  };

  return (
    <>
      <PageHeader title="Orders" description="Payment status comes from the payment provider. Confirm bank transfers here once they land." />
      <form
        className="afilters"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q || undefined);
        }}
      >
        <input className="input" type="search" placeholder="Order number, name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        <select className="select" value={paymentStatus ?? ""} onChange={(e) => setParam("paymentStatus", e.target.value || undefined)} aria-label="Payment status">
          <option value="">Any payment status</option>
          {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>
              {paymentStatusLabel[s]}
            </option>
          ))}
        </select>
        <select className="select" value={fulfillmentStatus ?? ""} onChange={(e) => setParam("fulfillmentStatus", e.target.value || undefined)} aria-label="Fulfilment status">
          <option value="">Any fulfilment status</option>
          {(Object.keys(fulfillmentStatusLabel) as FulfillmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {fulfillmentStatusLabel[s]}
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
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}`} className="atable__primary">
                          {o.number}
                        </Link>
                        <span className="small muted block">{formatDateTime(o.createdAt)}</span>
                      </td>
                      <td className="small">
                        {o.email}
                        <span className="muted block">{o.itemCount} items</span>
                      </td>
                      <td>
                        <OrderStatusBadges order={o} />
                      </td>
                      <td className="small">{paymentMethodLabel[o.paymentMethod]}</td>
                      <td className="num">{formatNaira(o.totals.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 ? (
              <div className="apager">
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page <= 1} onClick={() => setParam("page", String(data.page - 1))}>
                  Previous
                </button>
                <span className="small muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page >= data.totalPages} onClick={() => setParam("page", String(data.page + 1))}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty title="No orders match" body={query || paymentStatus || fulfillmentStatus ? "Clear a filter to see more." : "New orders appear here as customers check out."} />
        )
      ) : null}
    </>
  );
}

export default function OrdersPage() {
  return (
    <RequirePermission permission="orders:read">
      <Suspense>
        <Orders />
      </Suspense>
    </RequirePermission>
  );
}
