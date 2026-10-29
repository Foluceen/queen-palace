"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api/browser";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Cart } from "@/lib/types";

const STORAGE_KEY = "qp.cartId";

interface CartContextValue {
  cart: Cart | null;
  /** True until the stored cart has been fetched (or found absent). */
  loading: boolean;
  /** Line id or "add" while a mutation is in flight. */
  pending: string | null;
  error: string | null;
  drawerOpen: boolean;
  openDrawer(): void;
  closeDrawer(): void;
  addItem(variantId: string, quantity: number, productId?: string): Promise<boolean>;
  updateQuantity(lineId: string, quantity: number): Promise<void>;
  removeLine(lineId: string): Promise<void>;
  applyCode(code: string): Promise<string | null>;
  removeCode(code: string): Promise<void>;
  refresh(): Promise<void>;
  /** Called after checkout succeeds; the backend has already consumed the cart. */
  clear(): void;
  clearError(): void;
}

const CartContext = createContext<CartContextValue | null>(null);

const readId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: cart lives for this tab only */
  }
};

/**
 * Holds the backend cart. Every total shown in the UI comes from the cart the backend
 * returned; the frontend never recomputes prices, discounts or stock.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartIdRef = useRef<string | null>(null);

  const accept = useCallback((next: Cart) => {
    cartIdRef.current = next.id;
    writeId(next.id);
    setCart(next);
  }, []);

  const refresh = useCallback(async () => {
    const id = cartIdRef.current ?? readId();
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      accept(await api().call("getCart", { params: { cartId: id } }));
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        writeId(null);
        cartIdRef.current = null;
        setCart(null);
      } else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    void refresh();
    // Keep tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        cartIdRef.current = e.newValue;
        void refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity: number, productId?: string) => {
      setPending("add");
      setError(null);
      try {
        const id = cartIdRef.current;
        let next: Cart;
        if (id) {
          try {
            next = await api().call("addCartLines", { params: { cartId: id }, body: { lines: [{ variantId, quantity, ...(productId ? { productId } : {}) }] } });
          } catch (err) {
            if (!(err instanceof ApiError && err.isNotFound)) throw err;
            next = await api().call("createCart", { body: { lines: [{ variantId, quantity, ...(productId ? { productId } : {}) }] } });
          }
        } else {
          next = await api().call("createCart", { body: { lines: [{ variantId, quantity, ...(productId ? { productId } : {}) }] } });
        }
        accept(next);
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
      } finally {
        setPending(null);
      }
    },
    [accept],
  );

  const mutate = useCallback(
    async (key: string, fn: (cartId: string) => Promise<Cart>) => {
      const id = cartIdRef.current;
      if (!id) return;
      setPending(key);
      setError(null);
      try {
        accept(await fn(id));
      } catch (err) {
        if (err instanceof ApiError && err.isNotFound && err.code === "cart_not_found") {
          writeId(null);
          cartIdRef.current = null;
          setCart(null);
        }
        setError(errorMessage(err));
        throw err;
      } finally {
        setPending(null);
      }
    },
    [accept],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      pending,
      error,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addItem,
      updateQuantity: (lineId, quantity) => mutate(lineId, (cartId) => api().call("updateCartLine", { params: { cartId, lineId }, body: { quantity } })).catch(() => {}),
      removeLine: (lineId) => mutate(lineId, (cartId) => api().call("removeCartLine", { params: { cartId, lineId } })).catch(() => {}),
      applyCode: async (code) => {
        try {
          await mutate("discount", (cartId) => api().call("applyDiscount", { params: { cartId }, body: { code } }));
          return null;
        } catch (err) {
          setError(null);
          return errorMessage(err);
        }
      },
      removeCode: (code) => mutate("discount", (cartId) => api().call("removeDiscount", { params: { cartId, code } })).catch(() => {}),
      refresh,
      clear: () => {
        writeId(null);
        cartIdRef.current = null;
        setCart(null);
      },
      clearError: () => setError(null),
    }),
    [cart, loading, pending, error, drawerOpen, addItem, mutate, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
