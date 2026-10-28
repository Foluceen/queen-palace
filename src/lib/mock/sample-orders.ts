/**
 * Sample historical orders so the admin dashboard has something to show in mock mode.
 * Every one is marked as sample data, and the admin shows a demo-data banner.
 * Orders placed through the mock checkout are never marked paid.
 */
import type { FulfillmentStatus, Order, PaymentMethod, PaymentStatus, Product } from "@/lib/types";

const customers = [
  ["Adaeze", "O.", "sample.adaeze@example.com", "Osun", "Ilesha", 150000],
  ["Temitope", "A.", "sample.temi@example.com", "Oyo", "Ibadan", 500000],
  ["Hauwa", "B.", "sample.hauwa@example.com", "FCT - Abuja", "Wuse 2", 800000],
  ["Ngozi", "E.", "sample.ngozi@example.com", "Ondo", "Akure", 500000],
  ["Funke", "L.", "sample.funke@example.com", "Osun", "Osogbo", 300000],
  ["Chioma", "N.", "sample.chioma@example.com", "Enugu", "Enugu", 800000],
  ["Kemi", "J.", "sample.kemi@example.com", "Osun", "Ilesha", 0],
] as const;

const states: [PaymentStatus, FulfillmentStatus, PaymentMethod][] = [
  ["paid", "delivered", "paystack"],
  ["paid", "shipped", "paystack"],
  ["pending", "unfulfilled", "pay_on_delivery"],
  ["paid", "processing", "paystack"],
  ["pending", "unfulfilled", "pay_on_delivery"],
  ["paid", "delivered", "paystack"],
  ["refunded", "returned", "paystack"],
  ["paid", "out_for_delivery", "paystack"],
  ["failed", "unfulfilled", "paystack"],
  ["paid", "delivered", "pay_on_delivery"],
  ["paid", "delivered", "paystack"],
  ["paid", "unfulfilled", "paystack"],
  ["paid", "delivered", "pay_on_delivery"],
  ["paid", "processing", "paystack"],
  ["pending", "unfulfilled", "paystack"],
  ["paid", "delivered", "paystack"],
];

export function buildSampleOrders(products: Product[]): Order[] {
  return states.map(([paymentStatus, fulfillmentStatus, paymentMethod], i) => {
    const c = customers[i % customers.length]!;
    const p1 = products[(i * 5) % products.length]!;
    const p2 = products[(i * 3 + 7) % products.length]!;
    const v1 = p1.variants[i % p1.variants.length]!;
    const v2 = p2.variants[(i + 1) % p2.variants.length]!;
    const lines = [{ p: p1, v: v1, q: 1 }, ...(i % 3 === 0 ? [{ p: p2, v: v2, q: 1 + (i % 2) }] : [])].map(({ p, v, q }, li) => ({
      id: `ol_s${i}_${li}`,
      productId: p.id,
      variantId: v.id,
      title: p.title,
      variantTitle: v.title,
      sku: v.sku,
      image: p.media[0] ?? null,
      quantity: q,
      unitPrice: v.price,
      lineTotal: v.price * q,
    }));
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const shippingTotal = c[5];
    const pickup = shippingTotal === 0;
    const created = new Date(Date.UTC(2026, 9, 26, 9 + (i % 8), 0, 0));
    created.setUTCDate(created.getUTCDate() - Math.floor(i * 1.8));
    const number = `QP-${10400 + i}`;
    const createdAt = created.toISOString();
    const shipped = ["shipped", "out_for_delivery", "delivered"].includes(fulfillmentStatus);
    return {
      id: `ord_s${i}`,
      number,
      accessToken: `sample-${i}`,
      status: paymentStatus === "refunded" || fulfillmentStatus === "delivered" ? "completed" : "open",
      paymentStatus,
      fulfillmentStatus,
      paymentMethod,
      email: c[2],
      totals: { subtotal, discountTotal: 0, shippingTotal, taxTotal: 0, total: subtotal + shippingTotal },
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      createdAt,
      lines,
      contact: { email: c[2], phone: "08000000000", marketingOptIn: i % 2 === 0 },
      shippingAddress: { firstName: c[0], lastName: c[1], phone: "08000000000", line1: "Sample address", city: c[4], state: c[3], country: "NG" },
      shippingRate: pickup ? { id: "rate_ilesha_pickup", label: "Pick up in store", etaDays: [0, 1] } : c[3] === "Osun" ? { id: "rate_osun_std", label: "Osun courier", etaDays: [1, 2] } : { id: "rate_ng_std", label: "Nationwide courier", etaDays: [3, 6] },
      discounts: [],
      trackingNumber: shipped && !pickup ? `SAMPLE${700100 + i}` : null,
      carrier: shipped && !pickup ? "Courier" : null,
      note: null,
      bankTransfer: null,
      timeline: [{ id: `ev_s${i}_1`, type: "placed", message: "Order placed (sample data)", createdAt }],
    } satisfies Order;
  });
}
