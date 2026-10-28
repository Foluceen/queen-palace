"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api/browser";
import { Icon } from "@/components/ui/Icon";

const KEY = "irun.wishlist";
/** Non-sensitive hint set by the account page after sign-in; the session itself is an httpOnly cookie. */
export const SIGNED_IN_KEY = "irun.signedIn";

interface WishlistValue {
  ids: string[];
  has(id: string): boolean;
  toggle(id: string): void;
  /** Signed-in customers have their wishlist stored on the backend. */
  synced: boolean;
}

const Ctx = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let local: string[] = [];
    try {
      local = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      local = [];
    }
    setIds(local);
    // Only signed-in customers have a server copy; skip the request for guests.
    let signedIn = false;
    try {
      signedIn = localStorage.getItem(SIGNED_IN_KEY) === "1";
    } catch {
      signedIn = false;
    }
    if (!signedIn) return;
    api()
      .call("getWishlist")
      .then(async (server) => {
        const merged = [...new Set([...server.productIds, ...local])];
        if (merged.length !== server.productIds.length) await api().call("replaceWishlist", { body: { productIds: merged } });
        setIds(merged);
        setSynced(true);
      })
      .catch(() => setSynced(false));
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        if (synced) void api().call("replaceWishlist", { body: { productIds: next } }).catch(() => {});
        return next;
      });
    },
    [synced],
  );

  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle, synced }), [ids, toggle, synced]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWishlist must be used inside WishlistProvider");
  return v;
}

export function WishlistButton({ productId, title, className }: { productId: string; title: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  return (
    <button type="button" className={`wish-btn ${saved ? "is-saved" : ""} ${className ?? ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`} onClick={() => toggle(productId)}>
      <Icon name="heart" size={18} />
    </button>
  );
}
