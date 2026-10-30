"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { Empty, LoadError, LoadingRows, PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { formatDateTime, formatNaira } from "@/lib/format";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/types";

/** The few views the owner actually needs, as simple buttons instead of status dropdowns. */
const VIEWS: { key: string; label: string; paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus }[] = [
  { key: "all", label: "All orders" },
  { key: "send", label: "To send", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" },
  { key: "unpaid", label: "Not paid yet", paymentStatus: "pending" },
  { key: "sent", label: "Sent out", fulfillmentStatus: "shipped" },
  { key: "delivered", label: "Delivered", fulfillmentStatus: "delivered" },
];

function Orders() {
  const sp = useSearchParams();
  const router = useRouter();
  const paymentStatus = (sp.get("paymentStatus") as PaymentStatus) || undefined;
  const fulfillmentStatus = (sp.get("fulfillmentStatus") as FulfillmentStatus) || undefined;
  const query = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(query);
  const { data, error, loading, reload } = useResource(() => api().call("adminListOrders", { query: { q: query || undefined, paymentStatus, fulfillmentStatus, page, pageSize: 20 } }), [query, paymentStatus, fulfillmentStatus, page]);
  const current = VIEWS.find((v) => v.paymentStatus === paymentStatus && v.fulfillmentStatus === fulfillmentStatus);

  const go = (params: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in params)) next.delete("page");
    router.replace(`/admin/orders?${next.toString()}`);
  };

  return (
    <>
      <PageHeader title="Orders" description="Tap an order to see what to pack and where to send it." />
      <form
        className="afilters afilters--simple"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q || undefined });
        }}
      >
        <input className="input" type="search" placeholder="Order number or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find an order" />
        <button type="submit" className="btn btn--ghost">
          Find
        </button>
      </form>
      <div className="achips" role="group" aria-label="Show">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" className={`achip ${current?.key === v.key ? "is-on" : ""}`} aria-pressed={current?.key === v.key} onClick={() => go({ paymentStatus: v.paymentStatus, fulfillmentStatus: v.fulfillmentStatus })}>
            {v.label}
          </button>
        ))}
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.items.length ? (
          <>
            <ul className={`aplist aolist ${loading ? "is-pending" : ""}`}>
              {data.items.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="aolist__row">
                    <span className="aolist__main">
                      <span className="aolist__number">{o.number}</span>
                      <span className="small muted">
                        {formatDateTime(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                      </span>
                      <span className="small aolist__email">{o.email}</span>
                    </span>
                    <span className="aolist__side">
                      <span className="aolist__total">{formatNaira(o.totals.total)}</span>
                      <OrderStatusBadges order={o} />
                    </span>
                    <Icon name="chevronRight" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
            {data.totalPages > 1 ? (
              <div className="apager">
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page <= 1} onClick={() => go({ page: String(data.page - 1) })}>
                  Previous
                </button>
                <span className="small muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page >= data.totalPages} onClick={() => go({ page: String(data.page + 1) })}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty
            title={query || paymentStatus || fulfillmentStatus ? "No orders here" : "No orders yet"}
            body={query || paymentStatus || fulfillmentStatus ? "Tap “All orders” to see everything." : "New orders appear here as soon as a customer pays."}
          />
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
