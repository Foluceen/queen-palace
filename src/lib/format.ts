import type { Availability, FulfillmentStatus, Kobo, PaymentMethod, PaymentStatus } from "@/lib/types";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const nairaWithKobo = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formats integer kobo as naira, e.g. 16500000 → ₦165,000. Shows kobo only when non-zero. */
export function formatNaira(kobo: Kobo): string {
  return kobo % 100 === 0 ? naira.format(kobo / 100) : nairaWithKobo.format(kobo / 100);
}

export function formatPriceRange(range: { min: Kobo; max: Kobo }): string {
  return range.min === range.max ? formatNaira(range.min) : `From ${formatNaira(range.min)}`;
}

/** Parses a naira amount typed by staff ("165,000" or "165000.50") into kobo. */
export function parseNairaInput(input: string): Kobo | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!cleaned) return null;
  const v = Number(cleaned);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 100);
}

export function koboToInput(kobo: Kobo | null | undefined): string {
  if (kobo === null || kobo === undefined) return "";
  return (kobo / 100).toString();
}

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const dateTimeFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function formatEta([min, max]: [number, number]): string {
  if (max === 0) return "Today";
  if (min === max) return `${min} working day${min === 1 ? "" : "s"}`;
  return `${min}–${max} working days`;
}

export const availabilityLabel: Record<Availability, string> = {
  in_stock: "In stock",
  low_stock: "Only a few left",
  out_of_stock: "Sold out",
  preorder: "Preorder",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Waiting for payment",
  awaiting_transfer: "Waiting for transfer",
  authorized: "Payment approved",
  paid: "Paid",
  failed: "Payment didn't go through",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};

export const fulfillmentStatusLabel: Record<FulfillmentStatus, string> = {
  unfulfilled: "Not yet packed",
  processing: "Being packed",
  shipped: "Sent out",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  returned: "Returned",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  paystack: "Paystack",
  flutterwave: "Flutterwave",
  bank_transfer: "Bank transfer",
  pay_on_delivery: "Pay on delivery",
};

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
