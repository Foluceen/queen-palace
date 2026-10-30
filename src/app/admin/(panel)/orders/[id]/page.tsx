"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { OrderStatusBadges } from "@/components/admin/OrderBadges";
import { useToast } from "@/components/admin/Toast";
import { ConfirmButton, LoadError, LoadingRows, MoneyInput, PageHeader, Panel } from "@/components/admin/ui";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatEta, formatNaira, fulfillmentStatusLabel, paymentMethodLabel } from "@/lib/format";
import type { FulfillmentStatus, Kobo, Order } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { can } = useAdmin();
  const { data: order, setData, error, loading, reload } = useResource(() => api().call("adminGetOrder", { params: { id } }), [id]);
  const [fs, setFs] = useState<FulfillmentStatus>("processing");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [refundAmount, setRefundAmount] = useState<Kobo | null>(null);

  useEffect(() => {
    if (!order) return;
    setFs(order.fulfillmentStatus === "unfulfilled" ? "processing" : order.fulfillmentStatus);
    setCarrier(order.carrier ?? "");
    setTracking(order.trackingNumber ?? "");
    setRefundAmount(order.totals.total);
  }, [order]);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (loading || !order) return <LoadingRows rows={8} />;

  const run = async (key: string, fn: () => Promise<Order>, success: string) => {
    setBusy(key);
    try {
      setData(await fn());
      toast(success);
      return true;
    } catch (err) {
      toast(errorMessage(err), "danger");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const canWrite = can("orders:write") && order.status !== "cancelled";
  const a = order.shippingAddress;

  return (
    <RequirePermission permission="orders:read">
      <PageHeader
        back={
          <Link href="/admin/orders" className="aback small">
            <Icon name="chevronLeft" size={16} /> Orders
          </Link>
        }
        title={`Order ${order.number}`}
        description={
          <>
            Placed {formatDateTime(order.createdAt)} by {order.email}
          </>
        }
        actions={<OrderStatusBadges order={order} />}
      />

      <div className="aeditor">
        <div className="aeditor__main">
          <Panel title={`What they bought (${order.itemCount})`}>
            <ul className="aorder-lines">
              {order.lines.map((l) => (
                <li key={l.id}>
                  {l.image ? <Image src={l.image.url} alt="" width={48} height={60} unoptimized={l.image.url.startsWith("data:")} /> : <span className="atable__noimg" />}
                  <div>
                    <Link href={`/admin/products/${l.productId}`} className="atable__primary">
                      {l.title}
                    </Link>
                    {l.variantTitle && !/^default( title)?$/i.test(l.variantTitle) ? <p className="small muted">{l.variantTitle}</p> : null}
                  </div>
                  <span className="small">
                    {l.quantity} × {formatNaira(l.unitPrice)}
                  </span>
                  <span className="num">{formatNaira(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="totals aorder-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatNaira(order.totals.subtotal)}</dd>
              </div>
              {order.discounts.map((d) => (
                <div key={d.code} className="totals__discount">
                  <dt>Discount {d.code}</dt>
                  <dd>−{formatNaira(d.amount)}</dd>
                </div>
              ))}
              <div>
                <dt>{order.shippingRate.label ? `Delivery, ${order.shippingRate.label}` : "Delivery"}</dt>
                <dd>{formatNaira(order.totals.shippingTotal)}</dd>
              </div>
              <div className="totals__grand">
                <dt>Total</dt>
                <dd>{formatNaira(order.totals.total)}</dd>
              </div>
            </dl>
          </Panel>

          {canWrite ? (
            <Panel title="Send this order">
              {order.paymentStatus === "awaiting_transfer" ? <p className="notice notice--warning small">This order isn't paid yet. Don't send it until it shows Paid.</p> : null}
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run("fulfil", () => api().call("adminUpdateFulfillment", { params: { id }, body: { fulfillmentStatus: fs, carrier, trackingNumber: tracking, notifyCustomer: notify } }), `Marked ${fulfillmentStatusLabel[fs].toLowerCase()}`);
                }}
              >
                <SelectField label="Where is it now?" value={fs} onChange={(e) => setFs(e.target.value as FulfillmentStatus)}>
                  {(["processing", "shipped", "out_for_delivery", "delivered", "returned"] as FulfillmentStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {fulfillmentStatusLabel[s]}
                    </option>
                  ))}
                </SelectField>
                <TextField label="Who is delivering it? (optional)" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Rider or courier name" />
                <TextField label="Tracking number (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                <label className="checkbox" style={{ alignSelf: "end" }}>
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Send the customer an email about it
                </label>
                <div className="span-2">
                  <button type="submit" className="btn" disabled={busy === "fulfil"}>
                    {busy === "fulfil" ? <span className="spinner" aria-hidden /> : null}
                    Save
                  </button>
                </div>
              </form>
            </Panel>
          ) : null}

          <Panel title="History">
            <form
              className="anote"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run("note", () => api().call("adminAddOrderNote", { params: { id }, body: { message: note } }), "Note added")) setNote("");
              }}
            >
              <TextAreaField label="Write a private note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} hint="Only you and your staff can see this. The customer can't." />
              <button type="submit" className="btn btn--ghost btn--sm" disabled={!note.trim() || busy === "note"}>
                Add note
              </button>
            </form>
            <ul className="atimeline">
              {[...order.timeline].reverse().map((ev) => (
                <li key={ev.id} className={ev.internal ? "is-internal" : ""}>
                  <span className="small muted">{formatDateTime(ev.createdAt)}</span>
                  <span>{ev.message}</span>
                  {ev.internal ? <span className="badge">Staff only</span> : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="aeditor__side">
          <Panel title="Customer">
            {a.firstName || a.lastName ? (
              <p>
                {a.firstName} {a.lastName}
              </p>
            ) : null}
            {order.contact.email ? (
              <p className="small">
                <a href={`mailto:${order.contact.email}`}>{order.contact.email}</a>
              </p>
            ) : null}
            {order.contact.phone ? (
              <p className="small">
                <a href={`tel:${order.contact.phone}`}>{order.contact.phone}</a>
              </p>
            ) : null}
            {!order.contact.email && !order.contact.phone ? <p className="small muted">Contact details were not recorded for this order.</p> : null}
            {order.contact.marketingOptIn ? <p className="small muted">Wants emails about new stock</p> : null}
          </Panel>
          <Panel title="Send it to">
            {!a.line1 && !a.city ? (
              <p className="small muted">No delivery address was recorded for this order.</p>
            ) : (
            <address className="small aaddress">
              {a.line1}
              {a.line2 ? <>, {a.line2}</> : null}
              <br />
              {a.city}, {a.state}
              {a.landmark ? (
                <>
                  <br />
                  Landmark: {a.landmark}
                </>
              ) : null}
            </address>
            )}
            {order.shippingRate.label ? (
              <p className="small muted">
                {order.shippingRate.label}, {formatEta(order.shippingRate.etaDays).toLowerCase()}
              </p>
            ) : null}
            {order.note ? <p className="notice small">Message from the customer: {order.note}</p> : null}
          </Panel>
          <Panel title="Payment">
            <p>{paymentMethodLabel[order.paymentMethod]}</p>
            {order.paymentStatus === "awaiting_transfer" && can("orders:write") ? (
              <form
                className="astack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run("transfer", () => api().call("adminMarkTransferReceived", { params: { id }, body: { reference: transferRef } }), "Transfer confirmed. Order marked paid.");
                }}
              >
                <p className="small muted">Check your bank app for {formatNaira(order.totals.total)} with narration {order.number}.</p>
                <TextField label="Bank reference" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} required />
                <button type="submit" className="btn btn--sm" disabled={busy === "transfer"}>
                  Confirm transfer received
                </button>
              </form>
            ) : null}
            {order.paymentStatus === "pending" && order.paymentMethod !== "pay_on_delivery" ? <p className="small muted">Not paid yet. When the customer pays on Paystack, this changes to Paid by itself.</p> : null}
            {order.paymentStatus === "paid" ? <p className="small muted">Paid. You can see the money in your Paystack account.</p> : null}
            {can("orders:refund") && ["paid", "partially_refunded"].includes(order.paymentStatus) ? (
              <ConfirmButton
                label="Give money back"
                title={`Give money back for ${order.number}`}
                body="The money goes back to the card or account the customer paid with."
                confirmLabel="Give money back"
                danger
                onConfirm={async () => {
                  await run("refund", () => api().call("adminRefundOrder", { params: { id }, body: { amount: refundAmount ?? 0, reason: "Requested by staff" } }), "Money sent back");
                }}
              >
                <label className="field">
                  <span className="field__label">How much?</span>
                  <MoneyInput value={refundAmount} onChange={setRefundAmount} ariaLabel="Refund amount" />
                </label>
              </ConfirmButton>
            ) : null}
          </Panel>
          {canWrite && !["shipped", "out_for_delivery", "delivered"].includes(order.fulfillmentStatus) ? (
            <Panel title="Cancel order">
              <ConfirmButton
                label="Cancel order"
                title={`Cancel order ${order.number}?`}
                body="If the customer already paid, you also need to give the money back."
                confirmLabel="Cancel order"
                danger
                onConfirm={async () => {
                  await run("cancel", () => api().call("adminCancelOrder", { params: { id }, body: { reason: cancelReason, restock } }), "Order cancelled");
                }}
              >
                <TextField label="Why? (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Customer asked to cancel" />
                <label className="checkbox">
                  <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put items back in stock
                </label>
              </ConfirmButton>
            </Panel>
          ) : null}
        </aside>
      </div>
    </RequirePermission>
  );
}
