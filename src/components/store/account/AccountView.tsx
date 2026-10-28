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
import { PHONE_HINT } from "@/lib/phone";
import type { Address, Customer, OrderSummary, SavedAddress } from "@/lib/types";
import { AddressFields, emptyAddress } from "./AddressForm";

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
  const sp = useSearchParams();
  const next = sp.get("next");
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

  const done = () => {
    if (next && next.startsWith("/") && !next.startsWith("//")) router.push(next);
    else void load();
  };

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
  if (state === "guest") return <GuestAccess initialMode={sp.get("mode") === "register" ? "register" : "signin"} onSignedIn={done} />;

  return (
    <div className="account">
      <section className="account__hello">
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
      <div className="account__grid">
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
        <Addresses />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- addresses */

function Addresses() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<(Address & { id?: string; label: string; isDefault: boolean }) | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setList(await api().call("listAddresses"));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      setList(await api().call("saveAddress", { body: editing }));
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="acct-addresses">
      <div className="section-head section-head--row">
        <h2 id="acct-addresses" className="h3">
          Saved addresses
        </h2>
        {!editing ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ ...emptyAddress, label: "Home", isDefault: !list?.length })}>
            Add address
          </button>
        ) : null}
      </div>
      {loadError ? (
        <p className="notice notice--danger small">
          {loadError}{" "}
          <button type="button" className="link-btn" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : null}
      {editing ? (
        <form
          className="stack address-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <TextField label="Name this address" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Home, Work, Mum's house" />
          <AddressFields value={editing} onChange={(a) => setEditing({ ...editing, ...a })} errors={fields} />
          <label className="checkbox">
            <input type="checkbox" checked={editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} /> Use as my default address at checkout
          </label>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="cluster">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? <span className="spinner" aria-hidden /> : null}
              Save address
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : !list ? (
        loadError ? null : <div className="skeleton" style={{ height: 100 }} />
      ) : list.length ? (
        <ul className="addr-list">
          {list.map((a) => (
            <li key={a.id} className="addr">
              <p>
                <strong>{a.label}</strong> {a.isDefault ? <span className="badge badge--gold">Default</span> : null}
              </p>
              <p className="small">
                {a.firstName} {a.lastName}, {a.phone}
                <br />
                {a.line1}
                {a.landmark ? ` (${a.landmark})` : ""}, {a.city}, {a.state}
              </p>
              <div className="cluster">
                <button type="button" className="link-btn small" onClick={() => setEditing({ ...emptyAddress, ...a })}>
                  Edit
                </button>
                {!a.isDefault ? (
                  <button type="button" className="link-btn small" onClick={async () => setList(await api().call("saveAddress", { body: { ...a, isDefault: true } }))}>
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  className="link-btn small"
                  onClick={async () => {
                    try {
                      setList(await api().call("deleteAddress", { params: { id: a.id } }));
                    } catch (err) {
                      setLoadError(errorMessage(err));
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No saved addresses yet. Save one to check out faster.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------- sign in / register */

function GuestAccess({ initialMode, onSignedIn }: { initialMode: "signin" | "register"; onSignedIn(): void }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="account account--guest">
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === "signin"} className={`auth-tab ${mode === "signin" ? "is-on" : ""}`} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={`auth-tab ${mode === "register" ? "is-on" : ""}`} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>
        {mode === "signin" ? <SignIn onSignedIn={onSignedIn} /> : <Register onSignedIn={onSignedIn} />}
      </div>
      <div className="stack">
        <h2 className="h3">No account? No problem.</h2>
        <p className="muted">An account is optional. You can check out as a guest and track any order with its number and your email.</p>
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

function SignIn({ onSignedIn }: { onSignedIn(): void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
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
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      <p className="small">
        <Link href="/account/forgot">Forgot your password?</Link>
      </p>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        Sign in
      </button>
      {isMockMode ? <p className="small muted">Demo account: customer@queenpalace.test / demo-customer</p> : null}
    </form>
  );
}

function Register({ onSignedIn }: { onSignedIn(): void }) {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", marketingOptIn: false });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="stack auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setFields({});
        try {
          await api().call("customerRegister", { body: { ...f, phone: f.phone.trim() || undefined } });
          setHint(true);
          onSignedIn();
        } catch (err) {
          if (err instanceof ApiError && err.fields) setFields(err.fields);
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <TextField label="First name" value={f.firstName} onChange={set("firstName")} error={fields.firstName} required autoComplete="given-name" />
        <TextField label="Last name" value={f.lastName} onChange={set("lastName")} error={fields.lastName} required autoComplete="family-name" />
      </div>
      <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={fields.email} required autoComplete="email" />
      <TextField label="Phone (optional)" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} error={fields.phone} autoComplete="tel" hint={PHONE_HINT} />
      <TextField label="Password" type="password" value={f.password} onChange={set("password")} error={fields.password} required minLength={8} autoComplete="new-password" hint="At least 8 characters." />
      <label className="checkbox">
        <input type="checkbox" checked={f.marketingOptIn} onChange={(e) => setF({ ...f, marketingOptIn: e.target.checked })} /> Email me about new arrivals and offers
      </label>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden /> : null}
        Create account
      </button>
      <p className="small muted">
        By creating an account you agree to our <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </form>
  );
}
