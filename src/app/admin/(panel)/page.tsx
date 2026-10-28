"use client";

import Link from "next/link";
import { useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { Empty, LoadError, LoadingRows, PageHeader, Panel } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { formatDate, formatNaira } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

function RevenueChart({ series }: { series: DashboardSummary["revenueSeries"] }) {
  const max = Math.max(1, ...series.map((s) => s.amount));
  const w = 100 / series.length;
  return (
    <figure className="rchart">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Paid revenue per day">
        {series.map((s, i) => {
          const h = (s.amount / max) * 38;
          return (
            <rect key={s.date} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, s.amount ? 0.6 : 0.2)} className={s.amount ? "rchart__bar" : "rchart__bar is-zero"}>
              <title>
                {formatDate(s.date)}: {formatNaira(s.amount)}
              </title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="rchart__axis small muted">
        <span>{series[0] ? formatDate(series[0].date) : ""}</span>
        <span>{series.at(-1) ? formatDate(series.at(-1)!.date) : ""}</span>
      </figcaption>
    </figure>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useResource(() => api().call("adminDashboard", { query: { days } }), [days]);

  return (
    <RequirePermission permission="dashboard:read">
      <PageHeader
        title="Dashboard"
        description="Paid revenue and what needs attention today."
        actions={
          <select className="select select--sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows rows={6} /> : null}
      {data ? (
        <div className="adash">
          <div className="astats">
            <div className="astat astat--lead">
              <p className="astat__label">Paid revenue</p>
              <p className="astat__value">{formatNaira(data.revenue)}</p>
              <p className="small muted">{data.revenueChangePct === null ? "No sales in the previous period to compare" : `${data.revenueChangePct >= 0 ? "Up" : "Down"} ${Math.abs(data.revenueChangePct)}% on the previous ${data.periodDays} days`}</p>
              <RevenueChart series={data.revenueSeries} />
            </div>
            <div className="astat">
              <p className="astat__label">Orders</p>
              <p className="astat__value">{data.orders}</p>
              <p className="small muted">Average paid order {formatNaira(data.averageOrderValue)}</p>
            </div>
            <Link href="/admin/orders?fulfillmentStatus=unfulfilled" className="astat astat--link">
              <p className="astat__label">Paid, waiting to ship</p>
              <p className="astat__value">{data.awaitingFulfillment}</p>
            </Link>
            <Link href="/admin/orders?paymentStatus=awaiting_transfer" className="astat astat--link">
              <p className="astat__label">Waiting for payment</p>
              <p className="astat__value">{data.awaitingPayment}</p>
            </Link>
          </div>

          <div className="agrid-2">
            <Panel title="Recent orders" actions={<Link href="/admin/orders" className="small">All orders</Link>}>
              {data.recentOrders.length ? (
                <div className="atable-wrap">
                  <table className="atable">
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="num">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link href={`/admin/orders/${o.id}`} className="atable__primary">
                              {o.number}
                            </Link>
                            <span className="small muted"> {formatDate(o.createdAt)}</span>
                          </td>
                          <td>
                            <OrderStatusBadges order={o} />
                          </td>
                          <td className="num">{formatNaira(o.totals.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="No orders yet" body="Orders appear here as soon as customers check out." />
              )}
            </Panel>

            <div className="astack">
              <Panel title="Needs attention">
                <ul className="atodo">
                  <li>
                    <Link href="/admin/reviews?tab=messages">{data.newInquiries} new customer messages</Link>
                  </li>
                  <li>
                    <Link href="/admin/reviews">{data.pendingReviews} reviews waiting for approval</Link>
                  </li>
                  <li>
                    <Link href="/admin/inventory?low=1">{data.lowStock.length} variants low on stock</Link>
                  </li>
                </ul>
              </Panel>
              <Panel title="Low stock" actions={<Link href="/admin/inventory?low=1" className="small">Inventory</Link>}>
                {data.lowStock.length ? (
                  <ul className="alist">
                    {data.lowStock.map((l) => (
                      <li key={l.variantId}>
                        <span>
                          {l.productTitle} <span className="muted small">{l.variantTitle}</span>
                        </span>
                        <span className={`badge ${l.available === 0 ? "badge--danger" : "badge--warning"}`}>{l.available === 0 ? "Sold out" : `${l.available} left`}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="Stock looks healthy" />
                )}
              </Panel>
              <Panel title="Top products">
                {data.topProducts.length ? (
                  <ul className="alist">
                    {data.topProducts.map((t) => (
                      <li key={t.productId}>
                        <span>
                          {t.title} <span className="muted small">{t.unitsSold} sold</span>
                        </span>
                        <span>{formatNaira(t.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No paid sales in this period" />
                )}
              </Panel>
            </div>
          </div>
        </div>
      ) : null}
    </RequirePermission>
  );
}
