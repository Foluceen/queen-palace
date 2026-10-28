import { ApiError } from "@/lib/api/client";

/** Hosted payment pages must be https; anything else is refused. */
export function safePaymentRedirect(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A definite rejection (4xx other than timeout/conflict-in-progress) ends this attempt; a fresh key is used next time. */
export function shouldRotateIdempotencyKey(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
}
