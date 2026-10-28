"use client";

import Image from "next/image";
import { Price } from "@/components/ui/Price";
import { formatDate, formatDateTime, formatEta, fulfillmentStatusLabel, formatNaira, paymentMethodLabel, paymentStatusLabel } from "@/lib/format";
import type { FulfillmentStatus, Order } from "@/lib/types";

const progress: FulfillmentStatus[] = ["unfulfilled", "processing", "shipped", "out_for_delivery", "delivered"];
const progressLabel: Record<string, string> = { unfulfilled: "Order placed", processing: "Being packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered" };

function paymentTone(o: Order) {
  if (o.paymentStatus === "paid") return "badge--success";
  if (o.paymentStatus === "failed" || o.paymentStatus === "cancelled") return "badge--danger";
  if (o.paymentStatus === "refunded" || o.paymentStatus === "partially_refunded") return "badge--info";
  return "badge--warning";
}

export function OrderView({ order }: { order: Order }) {
  const step = progress.indexOf(order.fulfillmentStatus);
  const cancelled = order.status === "cancelled";
  return (
    <div className="order">
      <div className="cluster order__badges">
        <span className={`badge ${paymentTone(order)}`}>{paymentStatusLabel[order.paymentStatus]}</span>
        <span className="badge">{cancelled ? "Cancelled" : fulfillmentStatusLabel[order.fulfillmentStatus]}</span>
        <span className="small muted">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      {order.bankTransfer && order.paymentStatus === "awaiting_transfer" ? (
        <section className="transfer" aria-labelledby="transfer-title">
          <h2 id="transfer-title" className="h3">
            Complete your bank transfer
          </h2>
          <p className="muted">Transfer the exact amount and use your order number as the narration. We start packing as soon as it's confirmed.</p>
          <dl className="transfer__details">
            <div>
              <dt>Amount</dt>
              <dd>{formatNaira(order.bankTransfer.amount)}</dd>
            </div>
            <div>
              <dt>Bank</dt>
              <dd>{order.bankTransfer.bankName}</dd>
            </div>
            <div>
              <dt>Account name</dt>
              <dd>{order.bankTransfer.accountName}</dd>
            </div>
            <div>
              <dt>Account number</dt>
              <dd className="transfer__number">
                {order.bankTransfer.accountNumber}
                <button type="button" className="link-btn small" onClick={() => void navigator.clipboard?.writeText(order.bankTransfer!.accountNumber)}>
                  Copy
                </button>
              </dd>
            </div>
            <div>
              <dt>Narration</dt>
              <dd>{order.bankTransfer.reference}</dd>
            </div>
          </dl>
          {order.bankTransfer.expiresAt ? <p className="small muted">We'll hold your items until {formatDateTime(order.bankTransfer.expiresAt)}.</p> : null}
        </section>
      ) : null}

      {!cancelled && step >= 0 ? (
        <ol className="progress" aria-label="Delivery progress">
          {progress.map((s, i) => (
            <li key={s} className={i <= step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="progress__dot" aria-hidden />
              <span className="progress__label">{progressLabel[s]}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {order.trackingNumber ? (
        <p className="notice notice--info">
          {order.carrier ?? "Courier"} tracking number: <strong>{order.trackingNumber}</strong>
        </p>
      ) : null}

      <div className="order__grid">
        <section aria-labelledby="order-items">
          <h2 id="order-items" className="h3">
            Items
          </h2>
          <ul className="mini-lines">
            {order.lines.map((l) => (
              <li key={l.id}>
                <span className="mini-lines__media">
                  {l.image ? <Image src={l.image.url} alt="" width={56} height={70} sizes="56px" /> : null}
                  <span className="mini-lines__qty">{l.quantity}</span>
                </span>
                <span className="mini-lines__text">
                  <span>{l.title}</span>
                  <span className="small muted">{l.variantTitle}</span>
                </span>
                <Price amount={l.lineTotal} />
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>
                <Price amount={order.totals.subtotal} />
              </dd>
            </div>
            {order.totals.discountTotal ? (
              <div className="totals__discount">
                <dt>Discount</dt>
                <dd>
                  −<Price amount={order.totals.discountTotal} />
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Delivery</dt>
              <dd>{order.totals.shippingTotal ? <Price amount={order.totals.shippingTotal} /> : "Free"}</dd>
            </div>
            <div className="totals__grand">
              <dt>Total</dt>
              <dd>
                <Price amount={order.totals.total} />
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="order-delivery" className="order__side">
          <h2 id="order-delivery" className="h3">
            Delivery
          </h2>
          <address>
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state}
            <br />
            {order.shippingAddress.phone}
          </address>
          <p className="small muted">
            {order.shippingRate.label}, {formatEta(order.shippingRate.etaDays).toLowerCase()} once dispatched
          </p>
          <h2 className="h3">Payment</h2>
          <p>{paymentMethodLabel[order.paymentMethod]}</p>
          {order.timeline.length ? (
            <>
              <h2 className="h3">History</h2>
              <ul className="timeline small">
                {[...order.timeline].reverse().map((e) => (
                  <li key={e.id}>
                    <span className="muted">{formatDate(e.createdAt)}</span> {e.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
