"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/brand/Logo";

/** Admin-level errors (outside a single page) stay in the admin instead of showing the storefront message. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] error:", error);
  }, [error]);
  return (
    <main className="admin-boot" role="alert">
      <Logo variant="stacked" title="Queen Luxury Hair" />
      <h1 className="h3">The admin hit a problem</h1>
      <p className="muted">Your session is unchanged. Try again, or sign in again if it keeps happening.</p>
      <p className="small muted" style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
        {error.name}: {error.message}
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="cluster">
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/admin/login" className="btn btn--ghost">
          Sign in again
        </Link>
      </div>
    </main>
  );
}
