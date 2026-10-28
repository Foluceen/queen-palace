/**
 * Sample historical orders so the admin dashboard has something to show in mock mode.
 * These are labelled as sample data in the admin UI (mock banner). Orders placed through
 * the mock checkout are never marked paid.
 */
import type { FulfillmentStatus, Order, PaymentMethod, PaymentStatus, Product } from "@/lib/types";

const customers = [
  ["Adaeze", "Okafor", "adaeze@example.com", "Lagos", "Lekki"],
  ["Temitope", "Ade", "temi@example.com", "Oyo", "Ibadan"],
  ["Hauwa", "Bello", "hauwa@example.com", "FCT - Abuja", "Wuse 2"],
  ["Ngozi", "Eze", "ngozi@example.com", "Rivers", "Port Harcourt"],
  ["Funke", "Lawal", "funke@example.com", "Lagos", "Ikeja"],
  ["Chioma", "Nwosu", "chioma@example.com", "Enugu", "Independence Layout"],
  ["Zainab", "Musa", "zainab@example.com", "Kano", "Nassarawa GRA"],
] as const;

const states: [PaymentStatus, FulfillmentStatus, PaymentMethod][] = [
  ["paid", "delivered", "paystack"],
  ["paid", "shipped", "paystack"],
  ["awaiting_transfer", "unfulfilled", "bank_transfer"],
  ["paid", "processing", "bank_transfer"],
  ["pending", "unfulfilled", "pay_on_delivery"],
  ["paid", "delivered", "paystack"],
  ["refunded", "returned", "paystack"],
  ["paid", "out_for_delivery", "paystack"],
  ["failed", "unfulfilled", "paystack"],
  ["paid", "delivered", "bank_transfer"],
  ["paid", "delivered", "paystack"],
  ["paid", "unfulfilled", "paystack"],
  ["paid", "delivered", "pay_on_delivery"],
  ["paid", "processing", "paystack"],
  ["awaiting_transfer", "unfulfilled", "bank_transfer"],
  ["paid", "delivered", "paystack"],
];

export function buildSampleOrders(products: Product[]): Order[] {
  return states.map(([paymentStatus, fulfillmentStatus, paymentMethod], i) => {
    const c = customers[i % customers.length]!;
    const p1 = products[(i * 5) % products.length]!;
    const p2 = products[(i * 3 + 7) % products.length]!;
    const v1 = p1.variants[i % p1.variants.length]!;
    const v2 = p2.variants[(i + 1) % p2.variants.length]!;
    const lines = [
      { p: p1, v: v1, q: 1 },
      ...(i % 3 === 0 ? [{ p: p2, v: v2, q: 1 + (i % 2) }] : []),
    ].map(({ p, v, q }, li) => ({
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
    const shippingTotal = c[3] === "Lagos" ? 350000 : 850000;
    const created = new Date(Date.UTC(2026, 9, 26, 9 + (i % 8), 0, 0));
    created.setUTCDate(created.getUTCDate() - Math.floor(i * 1.8));
    const number = `IR-${10400 + i}`;
    const createdAt = created.toISOString();
    return {
      id: `ord_s${i}`,
      number,
      accessToken: `sample-${i}`,
      status: paymentStatus === "refunded" ? "completed" : fulfillmentStatus === "delivered" ? "completed" : "open",
      paymentStatus,
      fulfillmentStatus,
      paymentMethod,
      email: c[2],
      totals: { subtotal, discountTotal: 0, shippingTotal, taxTotal: 0, total: subtotal + shippingTotal },
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      createdAt,
      lines,
      contact: { email: c[2], phone: "+234 800 000 00" + String(10 + i), marketingOptIn: i % 2 === 0 },
      shippingAddress: { firstName: c[0], lastName: c[1], phone: "+234 800 000 00" + String(10 + i), line1: `${12 + i} Admiralty Road`, city: c[4], state: c[3], country: "NG" },
      shippingRate: c[3] === "Lagos" ? { id: "rate_lagos_std", label: "Lagos dispatch rider", etaDays: [1, 2] } : { id: "rate_ng_std", label: "Nationwide courier", etaDays: [3, 5] },
      discounts: [],
      trackingNumber: ["shipped", "out_for_delivery", "delivered"].includes(fulfillmentStatus) ? `GIG${700100 + i}` : null,
      carrier: ["shipped", "out_for_delivery", "delivered"].includes(fulfillmentStatus) ? (c[3] === "Lagos" ? "Ìrun riders" : "GIG Logistics") : null,
      note: null,
      bankTransfer: null,
      timeline: [{ id: `ev_s${i}_1`, type: "placed", message: "Order placed (sample data)", createdAt }],
    } satisfies Order;
  });
}
