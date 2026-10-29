"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Errors on one admin page stay inside the admin: the shell and its menu remain usable.
 * Without this, the root (storefront) boundary would replace the whole admin with
 * "The store is temporarily unavailable". Only the error type and message are shown,
 * which never contain response data.
 */
export default function AdminPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page error:", error);
  }, [error]);
  return (
    <div className="apanel" role="alert" style={{ display: "grid", gap: 12, maxWidth: 640 }}>
      <h1 className="h3">This admin page couldn&apos;t be shown</h1>
      <p className="muted">
        The page received data it couldn&apos;t display. The rest of the admin still works. If this keeps happening, send the developer this note:
      </p>
      <p className="small" style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
        {error.name}: {error.message}
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="cluster">
        <button type="button" className="btn btn--sm" onClick={reset}>
          Try again
        </button>
        <Link href="/admin/products" className="btn btn--ghost btn--sm">
          Go to products
        </Link>
      </div>
    </div>
  );
}
