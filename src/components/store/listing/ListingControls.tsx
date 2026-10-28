"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { decodeOptions, encodeOptions } from "@/lib/api/contract";
import { Icon } from "@/components/ui/Icon";
import type { Facet, ProductSort } from "@/lib/types";

const sorts: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "best_selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "price_desc", label: "Price, high to low" },
  { value: "rating", label: "Best rated" },
];

/**
 * Filters and sort live in the URL (shareable, back-button friendly). The server
 * re-renders the listing; this component only edits search params.
 */
export function ListingControls({ facets, total, children }: { facets: Facet[]; total: number; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const selected = decodeOptions(params.get("options"));
  const sort = (params.get("sort") as ProductSort) || "featured";
  const inStock = params.get("inStock") === "1";
  const activeCount = Object.values(selected).reduce((n, v) => n + v.length, 0) + (inStock ? 1 : 0);

  const push = (next: URLSearchParams) => {
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const toggle = (name: string, value: string) => {
    const current = selected[name] ?? [];
    const nextValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const nextOpts = { ...selected, [name]: nextValues };
    const next = new URLSearchParams(params);
    const enc = encodeOptions(nextOpts);
    if (enc) next.set("options", enc);
    else next.delete("options");
    push(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(params);
    next.delete("options");
    next.delete("inStock");
    push(next);
  };

  return (
    <div className="listing">
      <div className="listing__bar">
        <p className="listing__count" aria-live="polite">
          {pending ? "Updating…" : `${total} ${total === 1 ? "style" : "styles"}`}
        </p>
        <div className="cluster">
          {facets.length ? (
            <button type="button" className="btn btn--ghost btn--sm listing__toggle" aria-expanded={open} aria-controls="listing-filters" onClick={() => setOpen((o) => !o)}>
              Filter{activeCount ? ` (${activeCount})` : ""}
              <Icon name="chevronDown" size={16} />
            </button>
          ) : null}
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            className="select select--sm"
            value={sort}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value === "featured") next.delete("sort");
              else next.set("sort", e.target.value);
              push(next);
            }}
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`listing__layout ${open ? "is-open" : ""}`}>
        {facets.length ? (
          <aside id="listing-filters" className="filters" aria-label="Filters">
            {facets.map((f) => (
              <fieldset key={f.name} className="filters__group">
                <legend className="filters__legend">{f.name}</legend>
                <div className="filters__chips">
                  {f.values.map((v) => {
                    const on = selected[f.name]?.includes(v.value) ?? false;
                    return (
                      <button key={v.value} type="button" className={`chip ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(f.name, v.value)}>
                        {v.value}
                        <span className="chip__count">{v.count}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.checked) next.set("inStock", "1");
                  else next.delete("inStock");
                  push(next);
                }}
              />
              Hide sold-out styles
            </label>
            {activeCount ? (
              <button type="button" className="link-btn small" onClick={clearAll}>
                Clear all filters
              </button>
            ) : null}
          </aside>
        ) : null}
        <div className={`listing__results ${pending ? "is-pending" : ""}`} aria-busy={pending}>
          {children}
        </div>
      </div>
    </div>
  );
}
