"use client";

import Link from "next/link";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { LoadError, LoadingRows, Panel } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { isMockMode } from "@/lib/api/config";
import { formatDate, formatNaira } from "@/lib/format";
import type { Permission } from "@/lib/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

interface Action {
  href: string;
  icon: IconName;
  title: string;
  hint: string;
  permission: Permission;
  count?: number;
  primary?: boolean;
}

/**
 * The owner's home screen: big, plain-language actions first (they work even if the figures
 * below can't load), then a few simple numbers. No charts to interpret.
 */
export default function HomePage() {
  const { session, can } = useAdmin();
  const { data, error, loading, reload } = useResource(() => api().call("adminDashboard", { query: { days: 30 } }), []);
  const firstName = session.staff.name.split(" ")[0] || "there";

  const actions: Action[] = [
    { href: "/admin/products/new", icon: "plus", title: "Add a product", hint: "Photos, name, price and stock", permission: "products:write", primary: true },
    { href: "/admin/orders?paymentStatus=paid&fulfillmentStatus=unfulfilled", icon: "truck", title: "Orders to send", hint: "Paid orders waiting to be packed", permission: "orders:read", count: data?.awaitingFulfillment },
    { href: "/admin/inquiries", icon: "chat", title: "Messages", hint: "Questions from customers", permission: "inquiries:respond", count: data?.newInquiries },
    { href: "/admin/reviews", icon: "star", title: "Reviews to approve", hint: "Show them in the shop or not", permission: "reviews:moderate", count: data?.pendingReviews },
    { href: "/admin/products", icon: "box", title: "My products", hint: "Change prices, photos or stock", permission: "products:read" },
    { href: "/admin/collections", icon: "grip", title: "Collections", hint: "Group products, e.g. “Frontal wigs”", permission: "products:read" },
  ];

  return (
    <RequirePermission permission="dashboard:read">
      <header className="ahome__hello">
        <h1 className="ahome__title">
          {greeting()}, {firstName}
        </h1>
        <p className="muted">What would you like to do today?</p>
      </header>

      <ul className="ahome__actions">
        {actions
          .filter((a) => can(a.permission))
          .map((a) => (
            <li key={a.href}>
              <Link href={a.href} className={`ahome__action ${a.primary ? "is-primary" : ""}`}>
                <span className="ahome__icon" aria-hidden>
                  <Icon name={a.icon} size={22} />
                </span>
                <span className="ahome__text">
                  <span className="ahome__action-title">{a.title}</span>
                  <span className="ahome__hint">{a.hint}</span>
                </span>
                {typeof a.count === "number" && a.count > 0 ? <span className="ahome__count">{a.count}</span> : null}
              </Link>
            </li>
          ))}
      </ul>

      {error ? <LoadError message={`Your shop figures couldn't be loaded: ${error}`} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows rows={3} /> : null}

      {data ? (
        <>
          <section className="ahome__numbers" aria-label="Last 30 days">
            <h2 className="ahome__section">Last 30 days {isMockMode ? <span className="badge badge--warning">Sample data</span> : null}</h2>
            <div className="ahome__stats">
              <div className="ahome__stat">
                <span className="ahome__stat-label">Money from paid orders</span>
                <span className="ahome__stat-value">{formatNaira(data.revenue)}</span>
                {data.revenueChangePct !== null ? (
                  <span className={`small ${data.revenueChangePct >= 0 ? "ahome__up" : "ahome__down"}`}>
                    {data.revenueChangePct >= 0 ? "▲" : "▼"} {Math.abs(data.revenueChangePct)}% compared with the 30 days before
                  </span>
                ) : null}
              </div>
              <div className="ahome__stat">
                <span className="ahome__stat-label">Paid orders</span>
                <span className="ahome__stat-value">{data.orders}</span>
              </div>
              <Link href="/admin/orders?paymentStatus=pending" className="ahome__stat ahome__stat--link">
                <span className="ahome__stat-label">Waiting for payment</span>
                <span className="ahome__stat-value">{data.awaitingPayment}</span>
              </Link>
            </div>
          </section>

          <div className="ahome__grid">
            <Panel title="Running low" actions={<Link href="/admin/inventory" className="small">See all stock</Link>}>
              {data.lowStock.length ? (
                <ul className="alist">
                  {data.lowStock.slice(0, 6).map((l) => (
                    <li key={l.variantId || l.productId}>
                      <Link href={`/admin/products/${l.productId}`}>{l.productTitle}</Link>
                      <span className={`badge ${l.available <= 0 ? "badge--danger" : "badge--warning"}`}>{l.available <= 0 ? "Sold out" : `${l.available} left`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Nothing is running low.</p>
              )}
            </Panel>

            <Panel title="Latest orders" actions={<Link href="/admin/orders" className="small">See all orders</Link>}>
              {data.recentOrders.length ? (
                <ul className="alist">
                  {data.recentOrders.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`}>
                        <strong>{o.number}</strong> <span className="small muted">{formatDate(o.createdAt)}</span>
                      </Link>
                      <span className="ahome__order-meta">
                        <OrderStatusBadges order={o} />
                        <span>{formatNaira(o.totals.total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">No orders yet. They show up here as soon as a customer checks out.</p>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      <p className="ahome__help small muted">
        <Icon name="chat" size={14} /> Not sure where something is? Use the search box at the top, or open <strong>More</strong> in the menu.
      </p>
    </RequirePermission>
  );
}
