"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { animate } from "@/lib/motion/anime";
import type { SearchResult } from "@/lib/types";

const suggestions = ["Bone straight", "Bob", "613", "Knotless braids", "Bonnet"];

export function SearchDialog({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    void animate(d.querySelector(".search__panel"), { translateY: [-24, 0], opacity: [0, 1], duration: 380, ease: "outExpo" }, "essential");
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResult(null);
      return;
    }
    let active = true;
    const t = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api().call("search", { query: { q: term } });
        if (active) setResult(r);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [q]);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="search"
      aria-label="Search the store"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="search__panel container">
        <form
          role="search"
          className="search__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            close();
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Icon name="search" size={24} />
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input id="site-search" className="search__input" autoFocus placeholder="Search lengths, textures, shades" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
          {loading ? <span className="spinner" aria-label="Searching" /> : null}
          <button type="button" className="icon-btn" onClick={close} aria-label="Close search">
            <Icon name="close" />
          </button>
        </form>

        <div className="search__results" aria-live="polite">
          {error ? <p className="notice notice--danger">{error}</p> : null}
          {!result ? (
            <div className="cluster">
              <span className="muted small">Try</span>
              {suggestions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => setQ(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : result.products.total === 0 ? (
            <p className="muted">No matches for “{result.query}”. Try a length like 16&quot; or a shade like 613.</p>
          ) : (
            <>
              <ul className="search__list">
                {result.products.items.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link href={`/products/${p.handle}`} onClick={close} className="search__hit">
                      {p.image ? <Image quality={90} src={p.image.url} alt="" width={56} height={70} sizes="56px" /> : null}
                      <span>
                        <span className="search__hit-title">{p.title}</span>
                        <span className="small muted">{p.subtitle}</span>
                      </span>
                      <Price range={p.priceRange} />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/search?q=${encodeURIComponent(result.query)}`} onClick={close} className="btn btn--ghost btn--sm">
                See all {result.products.total} results
              </Link>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
