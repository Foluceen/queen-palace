import { ApiError } from "@/lib/api/client";
import type { PublicPaymentOptions } from "@/lib/types";

/**
 * Shoppers are only ever sent to Paystack's own hosted checkout (https, paystack.com or a
 * subdomain of it). Anything else is refused and the shopper sees their order page instead.
 */
export function safePaymentRedirect(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const paystack = host === "paystack.com" || host.endsWith(".paystack.com");
    return u.protocol === "https:" && paystack && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Codes meaning "an order with this key is still being created": the same key must be reused. */
const IN_PROGRESS_CODES = new Set(["idempotency_in_progress", "request_in_progress", "order_in_progress", "idempotency_conflict"]);

/** A definite rejection (4xx other than timeout, rate limit or in-progress) ends this attempt; a fresh key is used next time. */
export function shouldRotateIdempotencyKey(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 408 || err.status === 429 || IN_PROGRESS_CODES.has(err.code)) return false;
  return err.status >= 400 && err.status < 500;
}

const KEY_STORE = "qp.checkoutKey";

type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The checkout attempt's key survives a reload or a closed tab for the same bag, so a shopper who
 * refreshes after a slow or lost reply gets their existing order back instead of a second one.
 */
export function checkoutKeyFor(cartId: string, makeKey: () => string, store: KeyStore | null): string {
  try {
    const saved = store ? JSON.parse(store.getItem(KEY_STORE) ?? "null") : null;
    if (saved && saved.cartId === cartId && typeof saved.key === "string" && saved.key) return saved.key;
  } catch {}
  const key = makeKey();
  try {
    store?.setItem(KEY_STORE, JSON.stringify({ cartId, key }));
  } catch {}
  return key;
}

/** Ends the attempt: the next checkout starts with a fresh key. */
export function forgetCheckoutKey(store: KeyStore | null): void {
  try {
    store?.removeItem(KEY_STORE);
  } catch {}
}

export function browserStore(): KeyStore | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The shop takes payment through Paystack only. Whatever the backend lists, the checkout offers
 * Paystack alone (with shopper-friendly wording) or nothing if Paystack isn't switched on.
 */
export function paystackOnly(options: PublicPaymentOptions): PublicPaymentOptions {
  const m = options.methods.find((x) => x.method === "paystack");
  return {
    methods: m
      ? [{ method: "paystack", label: "Pay with card, bank transfer or USSD", description: "You'll pay securely on Paystack, then come straight back here." }]
      : [],
  };
}
