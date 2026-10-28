"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/store/ProductCard";
import { useWishlist } from "@/components/store/WishlistProvider";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { ProductCard as Card } from "@/lib/types";

export function WishlistView() {
  const { ids, synced } = useWishlist();
  const [items, setItems] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    let active = true;
    setError(null);
    api()
      .call("listProducts", { query: { ids: key, pageSize: 48 } })
      .then((r) => active && setItems(r.items))
      .catch((err) => active && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [key, nonce]);

  if (error) return <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />;
  if (!items) return <div className="skeleton" style={{ height: 320 }} aria-busy="true" />;
  // Keep the order the customer saved them in; drop removed items immediately.
  const visible = items.filter((p) => ids.includes(p.id));
  if (!visible.length) return <EmptyState title="Nothing saved yet" body="Tap the heart on any style to keep it here." action={{ label: "Browse collections", href: "/collections" }} />;
  return (
    <>
      {!synced ? <p className="small muted">Saved on this device. Sign in to keep your wishlist across devices.</p> : null}
      <div className="pgrid">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
