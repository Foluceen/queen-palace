"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Price } from "@/components/ui/Price";

/**
 * Recently viewed products, kept only in this browser (localStorage). It stores a small
 * display snapshot; prices shown here are indicative and the product page shows the live price.
 */
const KEY = "qp.recentlyViewed";
const MAX = 8;

export interface RecentItem {
  id: string;
  handle: string;
  title: string;
  image: { url: string; alt: string } | null;
  priceMin: number;
}

function read(): RecentItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? (raw.filter((x) => x && typeof x === "object" && typeof (x as RecentItem).handle === "string") as RecentItem[]) : [];
  } catch {
    return [];
  }
}

/** Records the current product and renders the others the shopper looked at. */
export function RecentlyViewed({ current }: { current: RecentItem }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    const prev = read().filter((x) => x.id !== current.id);
    setItems(prev.slice(0, 6));
    try {
      localStorage.setItem(KEY, JSON.stringify([current, ...prev].slice(0, MAX)));
    } catch {
      /* storage unavailable (private mode): nothing to remember */
    }
  }, [current]);

  if (!items.length) return null;
  return (
    <section className="container section--tight recent" aria-labelledby="recent-title">
      <div className="section-head section-head--row">
        <h2 id="recent-title" className="h3">
          Recently viewed
        </h2>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            try {
              localStorage.setItem(KEY, JSON.stringify([current]));
            } catch {}
            setItems([]);
          }}
        >
          Clear
        </button>
      </div>
      <ul className="recent__list">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.handle}`} className="recent__item">
              <span className="recent__img">{p.image ? <Image src={p.image.url} alt="" fill sizes="120px" /> : null}</span>
              <span className="recent__title">{p.title}</span>
              <span className="small muted">
                From <Price amount={p.priceMin} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
