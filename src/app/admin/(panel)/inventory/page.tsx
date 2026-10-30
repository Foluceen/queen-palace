"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { Empty, LoadError, LoadingRows, PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import type { InventoryRow } from "@/lib/types";

/** "Default", "Default Title" etc. mean the product has no sizes or colours: don't show them. */
function sizeName(r: InventoryRow): string {
  const t = r.variantTitle.trim();
  return !t || /^default( title)?$/i.test(t) ? "" : t;
}

function stockWords(r: InventoryRow): { text: string; tone: "ok" | "low" | "out" } {
  if (!r.tracked) return { text: "Not counted", tone: "ok" };
  if (r.available <= 0) return { text: "Sold out", tone: "out" };
  if (r.available <= Math.max(1, r.lowStockThreshold)) return { text: `Only ${r.available} left`, tone: "low" };
  return { text: `${r.available} in stock`, tone: "ok" };
}

/**
 * One product per card. The owner just types how many she has now (or taps − / +) and presses
 * Save; the difference is sent to the store as a stock change with a sensible reason.
 */
/**
 * What the shop itself shows for this product. The live backend currently keeps two stock
 * numbers (the product's and its size row's) and the Stock page only changes the first, so we
 * read the product back to catch the case where customers still see a different number.
 */
function useShopCount(row: InventoryRow, nonce: number): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    api()
      .call("adminGetProduct", { params: { id: row.productId } })
      .then((p) => {
        if (!live) return;
        const v = p.variants.find((x) => x.id === row.variantId) ?? (p.variants.length === 1 ? p.variants[0] : undefined);
        setCount(v && v.inventory.tracked ? v.inventory.available : null);
      })
      .catch(() => live && setCount(null));
    return () => {
      live = false;
    };
  }, [row.productId, row.variantId, nonce]);
  return count;
}

function StockCard({ row, canEdit, onSaved }: { row: InventoryRow; canEdit: boolean; onSaved(r: InventoryRow): void }) {
  const toast = useToast();
  const [count, setCount] = useState<string>(String(Math.max(0, row.available)));
  const [busy, setBusy] = useState(false);
  const shopCount = useShopCount(row, row.available);
  const mismatch = row.tracked && shopCount !== null && shopCount !== row.available;
  const target = Math.max(0, Math.trunc(Number(count)));
  const valid = count.trim() !== "" && Number.isFinite(Number(count)) && Number(count) >= 0;
  const delta = valid ? target - row.available : 0;
  const words = stockWords(row);
  const size = sizeName(row);
  const name = size ? `${row.productTitle} (${size})` : row.productTitle;

  const save = async () => {
    if (!delta) return;
    setBusy(true);
    try {
      const next = await api().call("adminAdjustInventory", {
        body: { variantId: row.variantId, productId: row.productId, delta, reason: delta > 0 ? "received" : "correction" },
      });
      onSaved(next);
      setCount(String(Math.max(0, next.available)));
      toast(`${name}: you now have ${next.available}`);
    } catch (err) {
      toast(errorMessage(err), "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`astock is-${words.tone}`}>
      <div className="astock__info">
        <Link href={`/admin/products/${row.productId}`} className="astock__name">
          {row.productTitle}
        </Link>
        {size ? <span className="astock__size">{size}</span> : null}
        <span className={`astock__badge is-${words.tone}`}>{words.text}</span>
      </div>

      {mismatch ? (
        <p className="notice notice--warning small astock__warn" role="status">
          <span>
            Your shop is still showing <strong>{shopCount <= 0 ? "Sold out" : `${shopCount} in stock`}</strong>, not {row.available}. This is a problem on the store&apos;s server that we&apos;ve
            reported. For now, <Link href={`/admin/products/${row.productId}`}>open the product</Link>, type {row.available} in “How many do you have?” and press Save.
          </span>
        </p>
      ) : null}

      {canEdit && row.tracked ? (
        <form
          className="astock__edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="astock__label" htmlFor={`stock-${row.variantId}`}>
            How many do you have now?
          </label>
          <div className="astock__stepper">
            <button type="button" className="astock__step" aria-label="One less" disabled={busy || target <= 0} onClick={() => setCount(String(Math.max(0, target - 1)))}>
              <Icon name="minus" size={18} />
            </button>
            <input
              id={`stock-${row.variantId}`}
              className="input astock__input"
              type="number"
              inputMode="numeric"
              min={0}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <button type="button" className="astock__step" aria-label="One more" disabled={busy} onClick={() => setCount(String(target + 1))}>
              <Icon name="plus" size={18} />
            </button>
          </div>
          {delta ? (
            <div className="astock__save">
              <span className="small muted">{delta > 0 ? `Adding ${delta}` : `Taking away ${-delta}`}</span>
              <button type="submit" className="btn btn--sm" disabled={busy}>
                {busy ? <span className="spinner" aria-hidden /> : null}
                Save
              </button>
              <button type="button" className="link-btn small" disabled={busy} onClick={() => setCount(String(Math.max(0, row.available)))}>
                Cancel
              </button>
            </div>
          ) : null}
        </form>
      ) : !row.tracked ? (
        <p className="small muted astock__note">The shop isn&apos;t counting this one, so it never sells out. To count it, open the product and turn on stock counting.</p>
      ) : null}
    </li>
  );
}

function Inventory() {
  const sp = useSearchParams();
  const { can } = useAdmin();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [lowOnly, setLowOnly] = useState(sp.get("low") === "1");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListInventory", { query: { q: query || undefined, lowOnly: lowOnly || undefined } }), [query, lowOnly]);
  const canEdit = can("inventory:write");

  return (
    <>
      <PageHeader title="Stock" description="How many of each product you have. Change the number and press Save." />
      <form
        className="afilters afilters--simple"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
      >
        <input className="input" type="search" placeholder="Find a product" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setQuery(q)} aria-label="Find a product" />
      </form>
      <div className="achips" role="group" aria-label="Show">
        <button type="button" className={`achip ${!lowOnly ? "is-on" : ""}`} aria-pressed={!lowOnly} onClick={() => setLowOnly(false)}>
          Everything
        </button>
        <button type="button" className={`achip ${lowOnly ? "is-on" : ""}`} aria-pressed={lowOnly} onClick={() => setLowOnly(true)}>
          Running low or sold out
        </button>
      </div>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <ul className="astocks">
            {data.map((r) => (
              <StockCard key={`${r.variantId}:${r.available}`} row={r} canEdit={canEdit} onSaved={(next) => setData((rows) => rows?.map((x) => (x.variantId === next.variantId ? next : x)) ?? null)} />
            ))}
          </ul>
        ) : (
          <Empty title={lowOnly ? "Nothing is running low" : query ? "No product with that name" : "No products yet"} body={!lowOnly && !query ? "Add a product and its stock shows up here." : undefined} />
        )
      ) : null}
    </>
  );
}

export default function InventoryPage() {
  return (
    <RequirePermission permission="products:read">
      <Suspense>
        <Inventory />
      </Suspense>
    </RequirePermission>
  );
}
