"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { Empty, LoadError, LoadingRows, PageHeader, Sheet, StatusBadge } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { isMockMode } from "@/lib/api/config";
import { formatDate, formatNaira } from "@/lib/format";

function CustomerSheet({ id, onClose }: { id: string | null; onClose(): void }) {
  const { data, error, loading, reload } = useResource(() => (id ? api().call("adminGetCustomer", { params: { id } }) : Promise.resolve(null)), [id]);
  return (
    <Sheet open={!!id} onClose={onClose} title={data?.name ?? "Customer"}>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows rows={4} /> : null}
      {data ? (
        <div className="astack">
          <div className="cluster">
            <StatusBadge tone={data.hasAccount ? "info" : "neutral"}>{data.hasAccount ? "Has an account" : "Guest checkout"}</StatusBadge>
            {data.marketingOptIn ? <StatusBadge tone="success">Subscribed to emails</StatusBadge> : null}
          </div>
          <dl className="adl">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${data.email}`}>{data.email}</a>
              </dd>
            </div>
            {data.phone ? (
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${data.phone}`}>{data.phone}</a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Orders</dt>
              <dd>{data.orderCount}</dd>
            </div>
            <div>
              <dt>Total paid</dt>
              <dd>{formatNaira(data.totalPaid)}</dd>
            </div>
            <div>
              <dt>Customer since</dt>
              <dd>{formatDate(data.createdAt)}</dd>
            </div>
          </dl>
          {data.addresses.length ? (
            <section>
              <h3 className="h4">Saved addresses</h3>
              <ul className="astack small">
                {data.addresses.map((a) => (
                  <li key={a.id}>
                    <strong>{a.label}</strong>
                    {a.isDefault ? " (default)" : ""}: {a.line1}, {a.city}, {a.state}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h3 className="h4">Orders</h3>
            {data.orders.length ? (
              <ul className="astack">
                {data.orders.map((o) => (
                  <li key={o.id} className="acustomer-order">
                    <Link href={`/admin/orders/${o.id}`} className="atable__primary">
                      {o.number}
                    </Link>
                    <span className="small muted">{formatDate(o.createdAt)}</span>
                    <OrderStatusBadges order={o} />
                    <span className="num">{formatNaira(o.totals.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No orders yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}

function CustomersInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const term = sp.get("q") ?? "";
  const openId = sp.get("id");
  const { data, error, loading, reload } = useResource(() => api().call("adminListCustomers", { query: { q: term || undefined, page, pageSize: 20 } }), [term, page]);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`/admin/customers${next.toString() ? `?${next}` : ""}`);
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (q !== term) setParams({ q: q.trim() || null, page: null });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <>
      <PageHeader title="Customers" description="People who have ordered from you or made an account." />
      {isMockMode ? <p className="notice notice--warning small">Sample customers (demo data). No real customer information is shown.</p> : null}
      <div className="afilters">
        <input type="search" className="input" placeholder="Search by name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.items.length ? (
          <>
            <div className="atable-wrap">
              <table className="atable">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Orders
                    </th>
                    <th scope="col" className="num">
                      Total paid
                    </th>
                    <th scope="col">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button type="button" className="link-btn atable__primary" onClick={() => setParams({ id: c.id })}>
                          {c.name}
                        </button>
                        <span className="block small muted">{c.email}</span>
                      </td>
                      <td>
                        <StatusBadge tone={c.hasAccount ? "info" : "neutral"}>{c.hasAccount ? "Account" : "Guest"}</StatusBadge>
                      </td>
                      <td className="num">{c.orderCount}</td>
                      <td className="num">{formatNaira(c.totalPaid)}</td>
                      <td>{c.lastOrderAt ? formatDate(c.lastOrderAt) : <span className="muted">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 ? (
              <div className="apager">
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page <= 1} onClick={() => setParams({ page: String(data.page - 1) })}>
                  Previous
                </button>
                <span className="small muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={data.page >= data.totalPages} onClick={() => setParams({ page: String(data.page + 1) })}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty title={term ? "No customers match" : "No customers yet"} body={term ? "Try a different name, email or phone number." : "Customers appear here after their first order or sign-up."} />
        )
      ) : null}
      <CustomerSheet id={openId} onClose={() => setParams({ id: null })} />
    </>
  );
}

export default function CustomersPage() {
  return (
    <RequirePermission permission="customers:read">
      <Suspense>
        <CustomersInner />
      </Suspense>
    </RequirePermission>
  );
}
