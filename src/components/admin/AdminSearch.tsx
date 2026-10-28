"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import type { AdminSearchResult } from "@/lib/types";

type Hit = { href: string; label: string; meta: string; group: string };

function flatten(r: AdminSearchResult): Hit[] {
  return [
    ...r.orders.map((o) => ({ href: `/admin/orders/${o.id}`, label: o.number, meta: o.email, group: "Orders" })),
    ...r.products.map((p) => ({ href: `/admin/products/${p.id}`, label: p.title, meta: p.subtitle, group: "Products" })),
    ...r.customers.map((c) => ({ href: `/admin/customers?id=${encodeURIComponent(c.id)}`, label: c.name, meta: c.email, group: "Customers" })),
    ...r.collections.map((c) => ({ href: `/admin/collections`, label: c.title, meta: "Collection", group: "Collections" })),
  ];
}

/**
 * Global admin search (orders, products, customers, collections). The backend filters
 * results by the signed-in staff member's permissions. Press "/" to focus.
 */
export function AdminSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await api().call("adminSearch", { query: { q: term } });
        if (!cancelled) {
          setHits(flatten(r));
          setActive(0);
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const go = (h: Hit) => {
    setQ("");
    setHits(null);
    inputRef.current?.blur();
    router.push(h.href);
  };

  const open = hits !== null;
  return (
    <div className="asearch">
      <Icon name="search" size={16} className="asearch__icon" />
      <input
        ref={inputRef}
        type="search"
        className="input asearch__input"
        placeholder="Search orders, products, customers"
        aria-label="Search the admin"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits.length ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!hits?.length) {
            if (e.key === "Escape") setQ("");
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(hits[active]!);
          } else if (e.key === "Escape") {
            setQ("");
          }
        }}
        onBlur={() => window.setTimeout(() => setHits(null), 150)}
      />
      <kbd className="asearch__kbd" aria-hidden>
        /
      </kbd>
      {open ? (
        <ul id={listId} role="listbox" className="asearch__list" aria-label="Search results">
          {loading && !hits.length ? <li className="asearch__empty small muted">Searching…</li> : null}
          {!loading && !hits.length ? <li className="asearch__empty small muted">Nothing found for “{q.trim()}”.</li> : null}
          {hits.map((h, i) => (
            <li
              key={`${h.group}-${h.href}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`asearch__hit ${i === active ? "is-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="asearch__group">{h.group}</span>
              <span className="asearch__label">{h.label}</span>
              <span className="asearch__meta small muted">{h.meta}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
