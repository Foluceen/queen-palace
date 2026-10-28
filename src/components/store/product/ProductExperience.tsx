"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/store/cart/CartProvider";
import { QuantityStepper } from "@/components/store/cart/CartLines";
import { WishlistButton } from "@/components/store/WishlistProvider";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { availabilityLabel } from "@/lib/format";
import { animate, interrupt } from "@/lib/motion/anime";
import type { Media, Product, Variant } from "@/lib/types";
import { LengthRuler } from "./LengthRuler";

const SHADE_HEX: Record<string, string> = { "1B": "#1E1614", "2": "#2C1D16", "4": "#4A2F22", "27": "#B47B3A", "613": "#E3C58F", "99J": "#5C1A2A", "350": "#A5482A", Plum: "#3B2340", Honey: "#C99A4B", Black: "#151012", Brown: "#5A3A28", Nude: "#C8A185" };

function purchasable(v: Variant) {
  return v.availability !== "out_of_stock";
}

function initialOptions(product: Product, variantId: string | null): Record<string, string> {
  const fromUrl = variantId ? product.variants.find((v) => v.id === variantId) : undefined;
  const v = fromUrl ?? product.variants.find(purchasable) ?? product.variants[0];
  return v ? { ...v.options } : {};
}

/* ------------------------------------------------------------------ gallery */

function Gallery({ media, activeId, title }: { media: Media[]; activeId: string | null; title: string }) {
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(0);

  useEffect(() => {
    if (!activeId) return;
    const i = media.findIndex((m) => m.id === activeId);
    if (i >= 0) setIndex(i);
  }, [activeId, media]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || prevIndex.current === index) return;
    const dir = index > prevIndex.current ? 1 : -1;
    prevIndex.current = index;
    const img = stage.querySelector<HTMLElement>(`[data-slide="${index}"]`);
    if (!img) return;
    void interrupt(img);
    void animate(img, { opacity: [0, 1], translateX: [dir * 28, 0], scale: [1.03, 1], duration: 620, ease: "outExpo" }, "essential");
  }, [index]);

  const go = useCallback((d: number) => setIndex((i) => (i + d + media.length) % media.length), [media.length]);

  if (!media.length) return <div className="gallery gallery--empty" aria-hidden />;

  return (
    <section className="gallery" aria-roledescription="carousel" aria-label={`${title} images`}>
      <div
        className="gallery__stage"
        ref={stageRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {media.map((m, i) => (
          <div key={m.id} className={`gallery__slide ${i === index ? "is-active" : ""}`} data-slide={i} aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${media.length}`}>
            <Image src={m.url} alt={m.alt} fill priority={i === 0} quality={i === 0 ? 65 : 75} sizes="(min-width: 960px) 52vw, 100vw" className="gallery__img" />
          </div>
        ))}
        {media.length > 1 ? (
          <div className="gallery__nav">
            <button type="button" className="icon-btn icon-btn--glass" onClick={() => go(-1)} aria-label="Previous image">
              <Icon name="chevronLeft" />
            </button>
            <span className="gallery__count small" aria-live="polite">
              {index + 1} / {media.length}
            </span>
            <button type="button" className="icon-btn icon-btn--glass" onClick={() => go(1)} aria-label="Next image">
              <Icon name="chevronRight" />
            </button>
          </div>
        ) : null}
      </div>
      {media.length > 1 ? (
        <div className="gallery__thumbs" role="tablist" aria-label="Choose image">
          {media.map((m, i) => (
            <button key={m.id} type="button" role="tab" aria-selected={i === index} className={`gallery__thumb ${i === index ? "is-active" : ""}`} onClick={() => setIndex(i)} aria-label={`Show image ${i + 1}`}>
              <Image src={m.url} alt="" width={72} height={90} sizes="72px" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------- add to cart */

function AddToCart({ variant, title }: { variant: Variant | undefined; title: string }) {
  const { addItem, pending, openDrawer, error, clearError } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const busy = pending === "add";

  useEffect(() => {
    setQty(1);
    setAdded(false);
  }, [variant?.id]);

  // Show the sticky mobile bar once the main button scrolls out of view.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBarVisible(!!e && !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!variant) {
    return (
      <button type="button" className="btn btn--block" disabled>
        This combination isn't made
      </button>
    );
  }
  const soldOut = variant.availability === "out_of_stock";
  const max = variant.inventory.tracked && variant.inventory.policy === "deny" ? Math.max(1, Math.min(10, variant.inventory.available)) : 10;
  const label = soldOut ? "Sold out" : busy ? "Adding" : added ? "Added to bag" : "Add to bag";

  const add = async () => {
    clearError();
    const ok = await addItem(variant.id, qty);
    if (ok) {
      setAdded(true);
      if (btnRef.current) void animate(btnRef.current, { scale: [0.94, 1.04, 1], duration: 520, ease: "outBack(1.6)" }, "essential");
      window.setTimeout(() => {
        openDrawer();
        setAdded(false);
      }, 650);
    }
  };

  return (
    <div className="buy" ref={boxRef}>
      <div className="buy__row">
        <QuantityStepper value={qty} max={max} onChange={(q) => setQty(Math.max(1, Math.min(max, q)))} disabled={soldOut || busy} label={`Quantity of ${title}`} />
        <button ref={btnRef} type="button" className={`btn btn--block buy__btn ${added ? "is-added" : ""}`} disabled={soldOut || busy} onClick={add}>
          {busy ? <span className="spinner" aria-hidden /> : added ? <Icon name="check" size={18} /> : <Icon name="bag" size={18} />}
          {label}
        </button>
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className={`buybar ${barVisible ? "is-visible" : ""}`} aria-hidden={!barVisible}>
        <div className="buybar__info">
          <span className="buybar__title">{title}</span>
          <span className="small muted">
            {variant.title}, <Price amount={variant.price} />
          </span>
        </div>
        <button type="button" className="btn btn--sm" disabled={soldOut || busy} onClick={add} tabIndex={barVisible ? 0 : -1}>
          {label}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- the experience */

export function ProductExperience({ product, initialVariantId, collection }: { product: Product; initialVariantId: string | null; collection: { handle: string; title: string } | null }) {
  const [selected, setSelected] = useState<Record<string, string>>(() => initialOptions(product, initialVariantId));
  const variant = useMemo(() => product.variants.find((v) => product.options.every((o) => v.options[o.name] === selected[o.name])), [product, selected]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep ?variant= in sync without a navigation, so the URL is shareable.
  useEffect(() => {
    if (!variant) return;
    if (process.env.NEXT_PUBLIC_PREVIEW_BUNDLE === "1") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", variant.id);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* some embedded frames refuse URL changes; the selection still works */
    }
  }, [variant]);

  // Variant feedback: the price ticks over when the selection changes.
  const priceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (priceRef.current) void animate(priceRef.current, { opacity: [0.35, 1], translateY: [6, 0], duration: 360, ease: "outQuart" }, "essential");
  }, [variant?.id]);

  const isAvailable = (name: string, value: string) => product.variants.some((v) => v.options[name] === value && purchasable(v) && product.options.every((o) => o.name === name || v.options[o.name] === selected[o.name]));
  const choose = (name: string, value: string) => {
    setSelected((prev) => {
      const next = { ...prev, [name]: value };
      // If that exact combination doesn't exist, pick the closest one that does.
      if (!product.variants.some((v) => product.options.every((o) => v.options[o.name] === next[o.name]))) {
        const fallback = product.variants.find((v) => v.options[name] === value && purchasable(v)) ?? product.variants.find((v) => v.options[name] === value);
        return fallback ? { ...fallback.options } : next;
      }
      return next;
    });
  };

  return (
    <div className="pdp">
      <Gallery media={product.media} activeId={variant?.mediaId ?? null} title={product.title} />
      <div className="pdp__panel" ref={panelRef}>
        <nav aria-label="Breadcrumb" className="crumbs small">
          <Link href="/collections">Collections</Link>
          {collection ? <span aria-hidden>/</span> : null}
          {collection ? <Link href={`/collections/${collection.handle}`}>{collection.title}</Link> : null}
        </nav>
        <h1 className="pdp__title display">{product.title}</h1>
        <p className="pdp__subtitle">{product.subtitle}</p>
        {product.rating.count ? (
          <a href="#reviews" className="pdp__rating small">
            <Icon name="star" size={16} />
            {product.rating.average.toFixed(1)} from {product.rating.count} reviews
          </a>
        ) : null}

        <div className="pdp__price" ref={priceRef} aria-live="polite">
          {variant ? <Price amount={variant.price} compareAt={variant.compareAtPrice} /> : <Price range={product.priceRange} />}
          {variant ? <span className={`pdp__stock pdp__stock--${variant.availability}`}>{variant.availability === "low_stock" && variant.inventory.tracked ? `Only ${variant.inventory.available} left` : availabilityLabel[variant.availability]}</span> : null}
        </div>

        <div className="options">
          {product.options.map((o) =>
            o.name === "Length" && o.values.length > 1 ? (
              <LengthRuler key={o.name} values={o.values} selected={selected[o.name]} isAvailable={(v) => isAvailable(o.name, v)} onSelect={(v) => choose(o.name, v)} />
            ) : o.values.length > 1 ? (
              <fieldset key={o.name} className="option">
                <legend className="option__legend">
                  {o.name} <span className="option__value">{selected[o.name]}</span>
                </legend>
                <div className="option__values" role="radiogroup" aria-label={o.name}>
                  {o.values.map((v) => {
                    const on = selected[o.name] === v;
                    const avail = isAvailable(o.name, v);
                    const hex = o.name === "Colour" ? SHADE_HEX[v] : undefined;
                    return (
                      <label key={v} className={`opt ${on ? "is-on" : ""} ${avail ? "" : "is-unavailable"} ${hex ? "opt--shade" : ""}`}>
                        <input type="radio" name={o.name} value={v} checked={on} onChange={() => choose(o.name, v)} className="sr-only" />
                        {hex ? <span className="opt__swatch" style={{ background: hex }} aria-hidden /> : null}
                        <span>{v}</span>
                        {!avail ? <span className="sr-only"> (sold out)</span> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <p key={o.name} className="small muted">
                {o.name}: {o.values[0]}
              </p>
            ),
          )}
        </div>

        <AddToCart variant={variant} title={product.title} />

        <div className="pdp__aside cluster">
          <WishlistButton productId={product.id} title={product.title} className="wish-btn--inline" />
          <span className="small muted">Save for later</span>
        </div>

        <ul className="pdp__assurances small">
          <li>
            <Icon name="truck" size={18} /> Lagos delivery in 1–2 days. Nationwide in 2–5.
          </li>
          <li>
            <Icon name="box" size={18} /> Seven-day returns on unworn hair with lace uncut.
          </li>
        </ul>
      </div>
    </div>
  );
}
