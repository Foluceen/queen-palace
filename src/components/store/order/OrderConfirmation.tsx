"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import type { Order } from "@/lib/types";
import { OrderView } from "./OrderView";

/**
 * Reads the order from the backend and, when returning from a hosted payment page,
 * asks the backend to verify the payment. The status shown is always the backend's.
 */
export function OrderConfirmation({ number, token, reference }: { number: string; token: string; reference: string | null }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean; denied?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const o = reference ? await api().call("verifyPayment", { params: { number }, body: { token, reference } }) : await api().call("getOrder", { params: { number }, query: { token } });
      setOrder(o);
    } catch (err) {
      setError({ message: errorMessage(err), notFound: err instanceof ApiError && err.isNotFound, denied: err instanceof ApiError && (err.status === 401 || err.status === 403) });
    }
  }, [number, token, reference]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    if (!token && error.denied) {
      return <ErrorState title="Sign in to see this order" message="Open the link from your order confirmation, sign in to the account you ordered with, or track your order with its number and email." />;
    }
    return error.notFound ? (
      <ErrorState title="We couldn't find this order" message="Check the link in your confirmation email, or look it up with your order number and email." />
    ) : (
      <ErrorState message={error.message} onRetry={() => void load()} />
    );
  }
  if (!order) return <div className="skeleton" style={{ height: 420 }} aria-busy="true" aria-label="Loading your order" />;

  const awaiting = order.paymentStatus === "pending" || order.paymentStatus === "authorized";
  const heading =
    order.paymentStatus === "paid"
      ? "Thank you. Your order is confirmed."
      : order.paymentStatus === "awaiting_transfer"
        ? "Your order is reserved."
        : order.paymentStatus === "failed"
          ? "Your payment didn't go through."
          : order.paymentMethod === "pay_on_delivery"
            ? "Your order is placed. Pay when it arrives."
            : "Your order is placed. Payment not yet confirmed.";

  return (
    <div className="confirm">
      <header className="page-head">
        <p className="muted">Order {order.number}</p>
        <h1 className="h1">{heading}</h1>
        <p className="lede">
          Bookmark this page to check on your order. You can also track it any time with order number <strong>{order.number}</strong> and {order.email}.
        </p>
      </header>
      {isMockMode ? <p className="notice notice--info">Demo mode: this order is stored in the mock server's memory. No payment provider is connected, so the payment stays pending.</p> : null}
      {awaiting && order.paymentMethod !== "pay_on_delivery" ? (
        <div className="notice notice--warning">
          <span>We haven't received confirmation from the payment provider yet. If you completed payment, check again in a moment.</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                // Both endpoints re-check a pending Paystack payment; verify needs the order link's token.
                setOrder(token ? await api().call("verifyPayment", { params: { number }, body: { token } }) : await api().call("getOrder", { params: { number }, query: { token } }));
              } catch (err) {
                setError({ message: errorMessage(err), notFound: false });
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? <span className="spinner" aria-hidden /> : null}
            Check payment status
          </button>
        </div>
      ) : null}
      <OrderView order={order} />
      <div className="cluster">
        <Link href="/collections" className="btn btn--ghost">
          Keep shopping
        </Link>
        <Link href="/contact" className="btn btn--ghost">
          Contact us about this order
        </Link>
      </div>
    </div>
  );
}
