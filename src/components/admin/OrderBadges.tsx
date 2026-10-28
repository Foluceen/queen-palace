import { fulfillmentStatusLabel, paymentStatusLabel } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";
import { StatusBadge } from "./ui";

export function OrderStatusBadges({ order }: { order: Pick<OrderSummary, "status" | "paymentStatus" | "fulfillmentStatus"> }) {
  const p = order.paymentStatus;
  const pTone = p === "paid" ? "success" : p === "failed" || p === "cancelled" ? "danger" : p === "refunded" || p === "partially_refunded" ? "info" : "warning";
  const f = order.fulfillmentStatus;
  const fTone = f === "delivered" ? "success" : f === "returned" ? "info" : f === "unfulfilled" ? "neutral" : "ink";
  return (
    <span className="cluster" style={{ ["--cluster" as string]: "6px" }}>
      {order.status === "cancelled" ? <StatusBadge tone="danger">Cancelled</StatusBadge> : null}
      <StatusBadge tone={pTone}>{paymentStatusLabel[p]}</StatusBadge>
      {order.status !== "cancelled" ? <StatusBadge tone={fTone}>{fulfillmentStatusLabel[f]}</StatusBadge> : null}
    </span>
  );
}
