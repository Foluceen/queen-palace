"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { animate, interrupt, stagger, type Controllable } from "@/lib/motion/anime";
import { CartLineList, CartTotals } from "./CartLines";
import { useCart } from "./CartProvider";

/**
 * Slide-over bag built on <dialog> (native focus trap, Esc to close, inert background).
 * Open/close animations are interruptible: toggling mid-animation reverses immediately.
 */
export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, loading, error, clearError } = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const running = useRef<Controllable | null>(null);
  const pathname = usePathname();

  // Close instantly on navigation, so the new page is never left inert behind a closing dialog.
  const instant = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      instant.current = true;
      running.current?.pause();
      dialog.close();
      if (panelRef.current) panelRef.current.style.transform = "";
      document.documentElement.classList.remove("is-locked");
    }
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;
    let cancelled = false;
    running.current?.pause();
    void interrupt([panel, dialog]);

    if (drawerOpen) {
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add("is-locked");
      void (async () => {
        const lines = panel.querySelectorAll("[data-cart-line]");
        running.current = await animate(panel, { translateX: ["100%", "0%"], duration: 520, ease: "outExpo" }, "essential");
        if (!cancelled && lines.length) {
          const delay = await stagger(45, { start: 120 });
          await animate(lines, { opacity: [0, 1], translateX: [24, 0], duration: 420, delay, ease: "outQuart" });
        }
      })();
    } else if (instant.current) {
      instant.current = false;
    } else if (dialog.open) {
      void (async () => {
        running.current = await animate(panel, { translateX: ["0%", "100%"], duration: 340, ease: "inOutQuart" }, "essential");
        const finish = () => {
          if (cancelled) return;
          dialog.close();
          panel.style.transform = "";
          document.documentElement.classList.remove("is-locked");
        };
        if (running.current) window.setTimeout(finish, 340);
        else finish();
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [drawerOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="cart-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        closeDrawer();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) closeDrawer();
      }}
    >
      <div ref={panelRef} className="drawer__panel">
        <header className="drawer__head">
          <h2 id="cart-drawer-title" className="h2">
            Your bag{cart?.itemCount ? <span className="drawer__count"> ({cart.itemCount})</span> : null}
          </h2>
          <button type="button" className="btn btn--ghost btn--icon" onClick={closeDrawer} aria-label="Close bag">
            <Icon name="close" />
          </button>
        </header>

        <div className="drawer__body">
          {error ? (
            <div className="notice notice--danger" role="alert">
              <span>{error}</span>
              <button type="button" className="link-btn small" onClick={clearError}>
                Dismiss
              </button>
            </div>
          ) : null}
          {cart?.notices.length ? (
            <div className="notice notice--warning" role="status">
              {cart.notices.join(" ")}
            </div>
          ) : null}
          {loading ? (
            <div className="drawer__skeleton" aria-hidden>
              <div className="skeleton" style={{ height: 110 }} />
              <div className="skeleton" style={{ height: 110 }} />
            </div>
          ) : cart && cart.lines.length ? (
            <CartLineList lines={cart.lines} compact onNavigate={closeDrawer} />
          ) : (
            <div className="drawer__empty">
              <p className="h2">Your bag is empty.</p>
              <p className="muted">Start with our most loved unit, or browse every collection.</p>
              <div className="cluster">
                <Link href="/products/bone-straight-double-drawn" className="btn">
                  Shop double drawn
                </Link>
                <Link href="/collections" className="btn btn--ghost">
                  All collections
                </Link>
              </div>
            </div>
          )}
        </div>

        {cart && cart.lines.length ? (
          <footer className="drawer__foot">
            <CartTotals />
            <Link href="/checkout" className="btn btn--block">
              Check out
            </Link>
            <Link href="/cart" className="btn btn--ghost btn--block">
              View bag and add a code
            </Link>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
