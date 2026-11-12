"use client";

import { DELIVERY_COST_TEXT, DELIVERY_RATE_ID, DELIVERY_SUMMARY } from "@/lib/delivery";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/store/cart/CartProvider";
import { DiscountForm } from "@/components/store/cart/CartLines";
import { SIGNED_IN_KEY } from "@/components/store/WishlistProvider";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Price } from "@/components/ui/Price";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import { variantLabel } from "@/lib/format";
import { browserStore, checkoutKeyFor, forgetCheckoutKey, safePaymentRedirect, shouldRotateIdempotencyKey } from "@/lib/checkout";
import { PHONE_HINT } from "@/lib/phone";
import { NIGERIAN_STATES, type Address, type PaymentMethod, type PublicPaymentOptions, type SavedAddress } from "@/lib/types";

const emptyAddress: Address = { firstName: "", lastName: "", phone: "", line1: "", line2: "", city: "", state: "", landmark: "", country: "NG" };

function toAddress(a: SavedAddress): Address {
  const { id: _id, label: _label, isDefault: _d, ...rest } = a;
  return { ...emptyAddress, ...rest };
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutView({ payment }: { payment: PublicPaymentOptions }) {
  const router = useRouter();
  const { cart, loading, refresh, clear, error: cartError } = useCart();
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">(payment.methods[0]?.method ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // One key per checkout attempt, saved per bag so it also survives a reload. Kept across retries of
  // the same attempt (timeouts, 5xx, lost replies), so the backend returns the same order instead of
  // creating two; replaced only after a definite rejection.
  const submitting = useRef(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  // Signed-in shoppers get their email and default address filled in. Guests see nothing different.
  useEffect(() => {
    let active = true;
    let hinted = false;
    try {
      hinted = localStorage.getItem(SIGNED_IN_KEY) === "1";
    } catch {}
    // Only ask for the account when this browser has signed in before (avoids a needless 401 for guests).
    if (!hinted) return;
    void (async () => {
      try {
        const { customer } = await api().call("getCustomer");
        if (!active) return;
        setSignedIn(true);
        setEmail((e) => e || customer.email);
        const list = await api().call("listAddresses");
        if (!active) return;
        setSaved(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setAddress((a) => (a.line1 ? a : toAddress(def)));
      } catch {
        /* guest checkout */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setA = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  if (loading) {
    return (
      <div className="checkout" aria-busy="true">
        <div className="skeleton" style={{ height: 520 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }
  if (!cart && cartError) return <ErrorState message={cartError} onRetry={() => void refresh()} />;
  if (!cart || !cart.lines.length) return <EmptyState title="Your bag is empty" body="Add something before checking out." action={{ label: "Browse collections", href: "/collections" }} />;

  // No delivery charge on the site: the driver is paid directly on arrival. The order itself is
  // always priced by the backend.
  const totals = cart.totals;

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) {
      setSubmitError("Choose how you'd like to pay.");
      return;
    }
    // Guard against double submits (double click, Enter + click) before React re-renders.
    if (submitting.current) return;
    submitting.current = true;
    setPlacing(true);
    setFields({});
    setSubmitError(null);
    const idempotencyKey = checkoutKeyFor(cart.id, newKey, browserStore());
    try {
      const result = await api().call("placeOrder", {
        body: {
          cartId: cart.id,
          contact: { email, phone: address.phone, marketingOptIn: optIn },
          shippingAddress: address,
          shippingRateId: DELIVERY_RATE_ID,
          paymentMethod: method,
          note: note || undefined,
          idempotencyKey,
        },
      }, { timeoutMs: 45000 });
      forgetCheckoutKey(browserStore());
      clear();
      const redirect = safePaymentRedirect(result.payment.redirectUrl);
      if (result.payment.redirectUrl && !redirect) {
        // Never send shoppers to an unexpected address. The order exists; show it with its payment status.
        router.push(`/order/${encodeURIComponent(result.order.number)}?token=${encodeURIComponent(result.order.accessToken)}`);
        return;
      }
      if (redirect) {
        // Paystack's hosted payment page. Paystack returns the shopper to the order page.
        window.location.assign(redirect);
        return;
      }
      router.push(`/order/${encodeURIComponent(result.order.number)}?token=${encodeURIComponent(result.order.accessToken)}`);
    } catch (err) {
      setPlacing(false);
      submitting.current = false;
      if (shouldRotateIdempotencyKey(err)) forgetCheckoutKey(browserStore());
      if (err instanceof ApiError) {
        if (err.fields) setFields(err.fields);
        if (err.code === "cart_changed" || err.code === "insufficient_stock") await refresh();
      }
      setSubmitError(errorMessage(err));
    }
  };

  return (
    <form className="checkout" onSubmit={place} noValidate>
      <div className="checkout__main">
        <section className="checkout__step" aria-labelledby="co-contact">
          <h2 id="co-contact" className="checkout__heading">
            Contact
          </h2>
          {signedIn ? null : (
            <p className="small muted">
              Have an account? <Link href="/account?next=/checkout">Sign in</Link>. Otherwise, check out as a guest. No account needed.
            </p>
          )}
          <div className="form-grid">
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required autoComplete="email" hint="We'll send your receipt and tracking here." />
            <TextField label="Phone" type="tel" value={address.phone} onChange={setA("phone")} error={fields.phone} required autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" hint={`${PHONE_HINT} We call this number about delivery.`} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} /> Email me when new textures arrive
          </label>
        </section>

        <section className="checkout__step" aria-labelledby="co-address">
          <h2 id="co-address" className="checkout__heading">
            Delivery address
          </h2>
          {saved.length ? (
            <SelectField
              label="Saved addresses"
              value={saved.find((a) => a.line1 === address.line1 && a.city === address.city && a.state === address.state)?.id ?? ""}
              onChange={(e) => {
                const a = saved.find((x) => x.id === e.target.value);
                setAddress(a ? toAddress(a) : { ...emptyAddress, phone: address.phone });
              }}
            >
              <option value="">Use a new address</option>
              {saved.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}: {a.line1}, {a.city}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className="form-grid">
            <TextField label="First name" value={address.firstName} onChange={setA("firstName")} error={fields.firstName} required autoComplete="given-name" />
            <TextField label="Last name" value={address.lastName} onChange={setA("lastName")} error={fields.lastName} required autoComplete="family-name" />
            <TextField label="Street address" value={address.line1} onChange={setA("line1")} error={fields.line1} required autoComplete="address-line1" wrapperClassName="span-2" />
            <TextField label="Apartment, estate or floor (optional)" value={address.line2} onChange={setA("line2")} autoComplete="address-line2" wrapperClassName="span-2" />
            <TextField label="Town or city" value={address.city} onChange={setA("city")} error={fields.city} required autoComplete="address-level2" placeholder="e.g. Ilesha" />
            <SelectField label="State" value={address.state} onChange={setA("state")} error={fields.state} required autoComplete="address-level1">
              <option value="">Choose a state</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <TextField label="Nearest landmark (optional)" value={address.landmark} onChange={setA("landmark")} wrapperClassName="span-2" hint="Helps the driver find you, e.g. opposite the filling station." />
          </div>
        </section>

        <section className="checkout__step" aria-labelledby="co-delivery">
          <h2 id="co-delivery" className="checkout__heading">
            Delivery
          </h2>
          <p className="notice notice--info">{DELIVERY_SUMMARY}</p>
          <p className="small muted">Make sure your phone number above is correct so the driver can reach you.</p>
        </section>

        <section className="checkout__step" aria-labelledby="co-payment">
          <h2 id="co-payment" className="checkout__heading">
            Payment
          </h2>
          {payment.methods.length ? (
            <div className="choices" role="radiogroup" aria-label="Payment method">
              {payment.methods.map((m) => (
                <label key={m.method} className={`choice ${method === m.method ? "is-on" : ""}`}>
                  <input type="radio" name="payment" value={m.method} checked={method === m.method} onChange={() => setMethod(m.method)} />
                  <span className="choice__body">
                    <span className="choice__title">{m.label}</span>
                    <span className="small muted">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="notice notice--warning">
              Online payment isn&apos;t switched on yet. <Link href="/contact">Message us</Link> and we&apos;ll help you complete your order.
            </p>
          )}
          {payment.methods.length ? <p className="small muted">Your card details go straight to Paystack. We never see or store them.</p> : null}
          {isMockMode ? <p className="notice notice--info small">Demo mode: placing an order records it with payment pending. No payment provider is connected, so you won't be charged.</p> : null}
          <TextAreaField
            label="Note for our team (optional)"
            hint="Your preferred park or driver, and anything else we should know."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </section>
      </div>

      <aside className="checkout__summary summary" aria-label="Order summary">
        <h2 className="h3">Your order</h2>
        <ul className="mini-lines">
          {cart.lines.map((l) => (
            <li key={l.id}>
              <span className="mini-lines__media">
                {l.image ? <Image quality={90} src={l.image.url} alt="" width={56} height={70} sizes="56px" /> : null}
                <span className="mini-lines__qty">{l.quantity}</span>
              </span>
              <span className="mini-lines__text">
                <span>{l.productTitle}</span>
                {variantLabel(l) ? <span className="small muted">{variantLabel(l)}</span> : null}
              </span>
              <Price amount={l.lineTotal} />
            </li>
          ))}
        </ul>
        <DiscountForm />
        <dl className="totals">
          <div>
            <dt>Subtotal</dt>
            <dd>
              <Price amount={totals.subtotal} />
            </dd>
          </div>
          {totals.discountTotal > 0 ? (
            <div className="totals__discount">
              <dt>Discount</dt>
              <dd>
                −<Price amount={totals.discountTotal} />
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Delivery</dt>
            <dd className="muted">{DELIVERY_COST_TEXT}</dd>
          </div>
          <div className="totals__grand">
            <dt>Total</dt>
            <dd>
              <Price amount={totals.total} />
            </dd>
          </div>
        </dl>
        {cart.notices.length ? <p className="notice notice--warning small">{cart.notices.join(" ")}</p> : null}
        {submitError ? (
          <p className="notice notice--danger" role="alert">
            {submitError}
          </p>
        ) : null}
        <button type="submit" className="btn btn--block" disabled={placing || !method}>
          {placing ? <span className="spinner" aria-hidden /> : null}
          {placing ? "Placing order" : method === "paystack" ? "Place order and pay with Paystack" : "Place order"}
        </button>
        <p className="small muted">The total above is confirmed by our system when you place the order.</p>
        <p className="small muted">
          By placing your order you agree to our <Link href="/terms">terms</Link>, <Link href="/returns">refund and cancellation policy</Link> and{" "}
          <Link href="/shipping">delivery policy</Link>. See how we handle your details in our <Link href="/privacy">privacy policy</Link>.
        </p>
      </aside>
    </form>
  );
}
