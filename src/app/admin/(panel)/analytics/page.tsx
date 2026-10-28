"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { Empty, LoadError, LoadingRows, PageHeader, Panel } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { isMockMode } from "@/lib/api/config";
import { formatDate, formatNaira } from "@/lib/format";
import type { AnalyticsReport, PaymentMethod } from "@/lib/types";

const methodLabel: Record<PaymentMethod, string> = {
  paystack: "Card (Paystack)",
  flutterwave: "Card (Flutterwave)",
  bank_transfer: "Bank transfer",
  pay_on_delivery: "Pay on delivery",
};

/** One series (paid revenue per day): a single hue, magnitude only. Each bar has a hover title; a table view sits below. */
function DailyRevenue({ series }: { series: AnalyticsReport["series"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => s.revenue));
  const w = 100 / Math.max(1, series.length);
  const h = hover !== null ? series[hover] : null;
  return (
    <figure className="rchart rchart--tall">
      <p className="rchart__readout small" aria-live="polite">
        {h ? (
          <>
            <strong>{formatDate(h.date)}</strong> · {formatNaira(h.revenue)} · {h.orders} {h.orders === 1 ? "order" : "orders"}
          </>
        ) : (
          <span className="muted">Hover a day for details</span>
        )}
      </p>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Paid revenue per day" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2="100" y1="39.9" y2="39.9" className="rchart__base" />
        {series.map((s, i) => {
          const bh = (s.revenue / max) * 37;
          return (
            <g key={s.date} onMouseEnter={() => setHover(i)}>
              {/* Hit target spans the full column, bigger than the bar. */}
              <rect x={i * w} y={0} width={w} height={40} fill="transparent" />
              <rect x={i * w + w * 0.18} y={40 - bh} width={w * 0.64} height={Math.max(bh, s.revenue ? 0.6 : 0.25)} className={`rchart__bar ${s.revenue ? "" : "is-zero"} ${hover === i ? "is-hover" : ""}`}>
                <title>
                  {formatDate(s.date)}: {formatNaira(s.revenue)}, {s.orders} orders
                </title>
              </rect>
            </g>
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

/** Horizontal magnitude bars with the value as text (never colour alone). */
function BarList({ rows }: { rows: { label: string; value: number; display: string; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="small muted">No paid orders in this period.</p>;
  return (
    <ul className="abars">
      {rows.map((r) => (
        <li key={r.label} className="abars__row">
          <span className="abars__label">{r.label}</span>
          <span className="abars__track" aria-hidden>
            <span className="abars__fill" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
          </span>
          <span className="abars__value">
            {r.display}
            {r.sub ? <span className="small muted"> {r.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsInner() {
  const [days, setDays] = useState(30);
  const [table, setTable] = useState(false);
  const { data, error, loading, reload } = useResource(() => api().call("adminAnalytics", { query: { days } }), [days]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Revenue counts paid orders only. Pending, failed and refunded payments are excluded."
        actions={
          <select className="select select--sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        }
      />
      {isMockMode ? <p className="notice notice--warning small">Sample orders only. These figures are demo data, not real sales.</p> : null}
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows rows={6} /> : null}
      {data ? (
        data.allOrders === 0 ? (
          <Empty title="No orders in this period" body="Analytics fill in as customers place orders." />
        ) : (
          <div className="adash">
            <div className="astats">
              <div className="astat">
                <p className="astat__label">Paid revenue</p>
                <p className="astat__value">{formatNaira(data.revenue)}</p>
              </div>
              <div className="astat">
                <p className="astat__label">Paid orders</p>
                <p className="astat__value">{data.paidOrders}</p>
                <p className="small muted">of {data.allOrders} placed</p>
              </div>
              <div className="astat">
                <p className="astat__label">Average paid order</p>
                <p className="astat__value">{formatNaira(data.averageOrderValue)}</p>
              </div>
              <div className="astat">
                <p className="astat__label">Units sold</p>
                <p className="astat__value">{data.unitsSold}</p>
                <p className="small muted">
                  {data.customers.new} new, {data.customers.returning} returning customers
                </p>
              </div>
            </div>

            <Panel
              title="Paid revenue per day"
              actions={
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
                  {table ? "Show chart" : "Show table"}
                </button>
              }
            >
              {table ? (
                <div className="atable-wrap">
                  <table className="atable">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col" className="num">
                          Orders
                        </th>
                        <th scope="col" className="num">
                          Paid revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.series.map((s) => (
                        <tr key={s.date}>
                          <td>{formatDate(s.date)}</td>
                          <td className="num">{s.orders}</td>
                          <td className="num">{formatNaira(s.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <DailyRevenue series={data.series} />
              )}
            </Panel>

            <div className="agrid-2">
              <Panel title="Top products">
                <BarList rows={data.topProducts.map((p) => ({ label: p.title, value: p.revenue, display: formatNaira(p.revenue), sub: `· ${p.unitsSold} sold` }))} />
              </Panel>
              <Panel title="By collection">
                <BarList rows={data.byCollection.map((c) => ({ label: c.title, value: c.revenue, display: formatNaira(c.revenue), sub: `· ${c.units} units` }))} />
              </Panel>
              <Panel title="By state">
                <BarList rows={data.byState.slice(0, 8).map((s) => ({ label: s.state, value: s.revenue, display: formatNaira(s.revenue), sub: `· ${s.orders} orders` }))} />
              </Panel>
              <Panel title="By payment method">
                <BarList rows={data.byPaymentMethod.map((m) => ({ label: methodLabel[m.method], value: m.revenue, display: formatNaira(m.revenue), sub: `· ${m.orders} orders` }))} />
              </Panel>
            </div>

            <Panel title="Discount codes">
              {data.discounts.length ? (
                <div className="atable-wrap">
                  <table className="atable">
                    <thead>
                      <tr>
                        <th scope="col">Code</th>
                        <th scope="col" className="num">
                          Uses
                        </th>
                        <th scope="col" className="num">
                          Given away
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.discounts.map((d) => (
                        <tr key={d.code}>
                          <td>
                            <code>{d.code}</code>
                          </td>
                          <td className="num">{d.uses}</td>
                          <td className="num">{formatNaira(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">No discount codes were used on paid orders in this period.</p>
              )}
            </Panel>
          </div>
        )
      ) : null}
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <RequirePermission permission="analytics:read">
      <AnalyticsInner />
    </RequirePermission>
  );
}

