"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SIGNED_IN_KEY } from "@/components/store/WishlistProvider";
import { TextField } from "@/components/ui/Field";
import { Price } from "@/components/ui/Price";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import { formatDate, fulfillmentStatusLabel, paymentStatusLabel } from "@/lib/format";
import type { Customer, OrderSummary } from "@/lib/types";

const setHint = (on: boolean) => {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* ignore */
  }
};

export function AccountView() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "signed-in" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const s = await api().call("getCustomer");
      setCustomer(s.customer);
      setHint(true);
      setState("signed-in");
      setOrders(await api().call("listCustomerOrders"));
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        setHint(false);
        setState("guest");
      } else {
        setError(errorMessage(err));
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") return <div className="skeleton" style={{ height: 280 }} aria-busy="true" aria-label="Loading your account" />;
  if (state === "error")
    return (
      <div className="state">
        <p className="muted">{error}</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  if (state === "guest")
    return (
      <SignIn
        onSignedIn={() => {
          if (next && next.startsWith("/")) router.push(next);
          else void load();
        }}
      />
    );

  return (
    <div className="account">
      <section>
        <h2 className="h2">Hello, {customer?.firstName}</h2>
        <p className="muted">{customer?.email}</p>
        <div className="cluster">
          <Link href="/wishlist" className="btn btn--ghost btn--sm">
            Your wishlist
          </Link>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={async () => {
              await api().call("customerLogout").catch(() => {});
              setHint(false);
              setCustomer(null);
              setState("guest");
            }}
          >
            Sign out
          </button>
        </div>
      </section>
      <section aria-labelledby="acct-orders">
        <h2 id="acct-orders" className="h3">
          Orders
        </h2>
        {!orders ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : orders.length === 0 ? (
          <p className="muted">
            No orders yet. <Link href="/collections">Start shopping</Link>.
          </p>
        ) : (
          <ul className="acct-orders">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/order/${o.number}?token=${encodeURIComponent(o.accessToken)}`} className="acct-orders__row">
                  <span>
                    <strong>{o.number}</strong>
                    <span className="small muted"> {formatDate(o.createdAt)}</span>
                  </span>
                  <span className="small">
                    {paymentStatusLabel[o.paymentStatus]}, {fulfillmentStatusLabel[o.fulfillmentStatus].toLowerCase()}
                  </span>
                  <Price amount={o.totals.total} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SignIn({ onSignedIn }: { onSignedIn(): void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="account account--guest">
      <form
        className="stack auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api().call("customerLogin", { body: { email, password } });
            setHint(true);
            onSignedIn();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="h2">Sign in</h2>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden /> : null}
          Sign in
        </button>
        {isMockMode ? <p className="small muted">Demo account: customer@irun.test / demo-customer</p> : null}
      </form>
      <div className="stack">
        <h2 className="h3">No account? No problem.</h2>
        <p className="muted">You can check out as a guest and track any order with its number and your email.</p>
        <div className="cluster">
          <Link href="/track" className="btn btn--ghost">
            Track an order
          </Link>
          <Link href="/collections" className="btn btn--ghost">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
