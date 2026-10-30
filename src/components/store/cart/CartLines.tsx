"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { availabilityLabel, variantLabel } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { useCart } from "./CartProvider";

export function QuantityStepper({ value, max, disabled, onChange, label }: { value: number; max: number; disabled?: boolean; onChange(next: number): void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Icon name="minus" size={16} />
      </button>
      <output className="stepper__value" aria-live="polite">
        {value}
      </output>
      <button type="button" className="stepper__btn" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

function Line({ line, compact, onNavigate }: { line: CartLine; compact?: boolean; onNavigate?: () => void }) {
  const { pending, updateQuantity, removeLine } = useCart();
  const busy = pending === line.id;
  return (
    <li className={`cart-line ${busy ? "is-busy" : ""}`} data-cart-line>
      <Link href={`/products/${line.handle}`} className="cart-line__media" onClick={onNavigate} tabIndex={-1} aria-hidden>
        {line.image ? <Image quality={90} src={line.image.url} alt="" width={compact ? 88 : 120} height={compact ? 110 : 150} sizes={compact ? "88px" : "120px"} /> : null}
      </Link>
      <div className="cart-line__body">
        <div className="cart-line__head">
          <Link href={`/products/${line.handle}`} className="cart-line__title" onClick={onNavigate}>
            {line.productTitle}
          </Link>
          <Price amount={line.lineTotal} />
        </div>
        {variantLabel(line) ? <p className="cart-line__variant muted small">{variantLabel(line)}</p> : null}
        {line.availability === "low_stock" ? <p className="small cart-line__stock">{availabilityLabel.low_stock}</p> : null}
        <div className="cart-line__actions">
          <QuantityStepper value={line.quantity} max={line.maxQuantity} disabled={busy} onChange={(q) => void updateQuantity(line.id, q)} label={`Quantity for ${line.productTitle}`} />
          <button type="button" className="link-btn small" onClick={() => void removeLine(line.id)} disabled={busy}>
            Remove<span className="sr-only"> {line.productTitle}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartLineList({ lines, compact, onNavigate }: { lines: CartLine[]; compact?: boolean; onNavigate?: () => void }) {
  return (
    <ul className={`cart-lines ${compact ? "cart-lines--compact" : ""}`}>
      {lines.map((l) => (
        <Line key={l.id} line={l} compact={compact} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

export function DiscountForm() {
  const { cart, applyCode, removeCode, pending } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!cart) return null;
  const busy = pending === "discount";
  return (
    <div className="discount">
      {cart.discounts.length ? (
        <ul className="discount__applied">
          {cart.discounts.map((d) => (
            <li key={d.code} className="cluster">
              <span className="badge badge--gold">{d.code}</span>
              <span className="small muted">{d.label}</span>
              <button type="button" className="link-btn small" onClick={() => void removeCode(d.code)} disabled={busy}>
                Remove<span className="sr-only"> code {d.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="discount__form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!code.trim()) return;
            const err = await applyCode(code.trim());
            setError(err);
            if (!err) setCode("");
          }}
        >
          <label className="sr-only" htmlFor="discount-code">
            Discount code
          </label>
          <input id="discount-code" className="input" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" aria-invalid={!!error || undefined} aria-describedby={error ? "discount-error" : undefined} />
          <button type="submit" className="btn btn--ghost" disabled={busy || !code.trim()}>
            {busy ? <span className="spinner" aria-hidden /> : null}Apply
          </button>
        </form>
      )}
      {error ? (
        <p className="field__error" id="discount-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CartTotals({ showShippingNote = true }: { showShippingNote?: boolean }) {
  const { cart } = useCart();
  if (!cart) return null;
  const t = cart.totals;
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>
          <Price amount={t.subtotal} />
        </dd>
      </div>
      {t.discountTotal > 0 ? (
        <div className="totals__discount">
          <dt>Discount</dt>
          <dd>−<Price amount={t.discountTotal} /></dd>
        </div>
      ) : null}
      <div>
        <dt>Delivery</dt>
        <dd className="muted">{t.shippingTotal === null ? "Calculated at checkout" : <Price amount={t.shippingTotal} />}</dd>
      </div>
      <div className="totals__grand">
        <dt>{t.shippingTotal === null ? "Estimated total" : "Total"}</dt>
        <dd>
          <Price amount={t.total} />
        </dd>
      </div>
      {showShippingNote && t.shippingTotal === null ? <p className="small muted totals__note">Your final total, including delivery, is confirmed at checkout.</p> : null}
    </dl>
  );
}
