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

/** A definite rejection (4xx other than timeout/conflict-in-progress) ends this attempt; a fresh key is used next time. */
export function shouldRotateIdempotencyKey(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
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
