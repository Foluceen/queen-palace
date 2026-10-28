"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminSession";
import { useResource } from "@/components/admin/hooks";
import { useToast } from "@/components/admin/Toast";
import { Empty, LoadError, LoadingRows, PageHeader, StatusBadge, Switch } from "@/components/admin/ui";
import { api } from "@/lib/api/browser";
import { errorMessage } from "@/lib/api/client";
import { availabilityLabel } from "@/lib/format";
import type { InventoryAdjustment, InventoryRow } from "@/lib/types";

function AdjustCell({ row, onDone }: { row: InventoryRow; onDone(r: InventoryRow): void }) {
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<InventoryAdjustment["reason"]>("received");
  const [busy, setBusy] = useState(false);
  const n = Math.trunc(Number(delta));
  return (
    <form
      className="aadjust"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!n) return;
        setBusy(true);
        try {
          const r = await api().call("adminAdjustInventory", { body: { variantId: row.variantId, delta: n, reason } });
          onDone(r);
          setDelta("");
          toast(`${row.productTitle} ${row.variantTitle}: ${n > 0 ? "+" : ""}${n}, now ${r.available}`);
        } catch (err) {
          toast(errorMessage(err), "danger");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="input input--sm" inputMode="numeric" placeholder="+5 or -2" value={delta} onChange={(e) => setDelta(e.target.value)} aria-label={`Adjust stock for ${row.productTitle} ${row.variantTitle}`} />
      <select className="select select--xs" value={reason} onChange={(e) => setReason(e.target.value as InventoryAdjustment["reason"])} aria-label="Reason">
        <option value="received">Received</option>
        <option value="correction">Count correction</option>
        <option value="damaged">Damaged</option>
        <option value="returned">Returned</option>
      </select>
      <button type="submit" className="btn btn--sm" disabled={busy || !n}>
        Apply
      </button>
    </form>
  );
}

function Inventory() {
  const sp = useSearchParams();
  const { can } = useAdmin();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [lowOnly, setLowOnly] = useState(sp.get("low") === "1");
  const { data, setData, error, loading, reload } = useResource(() => api().call("adminListInventory", { query: { q: query || undefined, lowOnly: lowOnly || undefined } }), [query, lowOnly]);

  return (
    <>
      <PageHeader title="Inventory" description="Stock for every variant. Every adjustment is recorded with a reason." />
      <form
        className="afilters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
      >
        <input className="input" type="search" placeholder="Search product, variant or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
        <Switch checked={lowOnly} onChange={setLowOnly} label="Low and sold out only" />
      </form>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data ? (
        data.length ? (
          <div className="atable-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">
                    Available
                  </th>
                  <th scope="col">Status</th>
                  {can("inventory:write") ? <th scope="col">Adjust</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.variantId}>
                    <td>
                      <Link href={`/admin/products/${r.productId}`} className="atable__primary">
                        {r.productTitle}
                      </Link>
                      <span className="small muted"> {r.variantTitle}</span>
                    </td>
                    <td className="small mono">{r.sku}</td>
                    <td className="num">{r.tracked ? r.available : "Not tracked"}</td>
                    <td>
                      <StatusBadge tone={r.availability === "in_stock" ? "success" : r.availability === "out_of_stock" ? "danger" : "warning"}>{availabilityLabel[r.availability]}</StatusBadge>
                    </td>
                    {can("inventory:write") ? (
                      <td>
                        {r.tracked ? <AdjustCell row={r} onDone={(next) => setData((rows) => rows?.map((x) => (x.variantId === next.variantId ? next : x)) ?? null)} /> : <span className="small muted">Turn on tracking in the product</span>}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={lowOnly ? "Nothing is running low" : "No variants match"} />
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
