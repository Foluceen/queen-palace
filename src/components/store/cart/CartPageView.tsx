"use client";

import Link from "next/link";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CartLineList, CartTotals, DiscountForm } from "./CartLines";
import { useCart } from "./CartProvider";

export function CartPageView() {
  const { cart, loading, error, refresh } = useCart();

  if (loading) {
    return (
      <div className="cart-page" aria-busy="true">
        <div className="skeleton" style={{ height: 160 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }
  if (!cart && error) return <ErrorState message={error} onRetry={() => void refresh()} />;
  if (!cart || !cart.lines.length) {
    return <EmptyState title="Your bag is empty" body="Find your next unit in our collections." action={{ label: "Browse collections", href: "/collections" }} />;
  }

  return (
    <div className="cart-page">
      <div>
        {cart.notices.length ? (
          <div className="notice notice--warning" role="status">
            {cart.notices.join(" ")}
          </div>
        ) : null}
        {error ? (
          <div className="notice notice--danger" role="alert">
            {error}
          </div>
        ) : null}
        <CartLineList lines={cart.lines} />
      </div>
      <aside className="summary" aria-label="Order summary">
        <h2 className="h3">Summary</h2>
        <DiscountForm />
        <CartTotals />
        <Link href="/checkout" className="btn btn--block">
          Check out
        </Link>
        <p className="small muted">Guest checkout. No account needed.</p>
      </aside>
    </div>
  );
}
