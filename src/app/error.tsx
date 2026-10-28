"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";

/**
 * Shown when the storefront shell itself can't load (store settings or menus unavailable).
 * Server error details are hidden in production, so the message stays general; the digest
 * lets the team match it to the server log.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="unavailable" role="alert">
      <Logo variant="stacked" title="Queen Luxury Hair" className="unavailable__logo" />
      <h1 className="h2">The store is temporarily unavailable</h1>
      <p className="muted">We couldn't load the shop just now. Please try again in a few minutes.</p>
      <button type="button" className="btn" onClick={reset}>
        Try again
      </button>
      {error.digest ? <p className="small muted">Reference: {error.digest}</p> : null}
    </main>
  );
}
