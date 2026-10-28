"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Icon } from "@/components/ui/Icon";
import { animate, stagger } from "@/lib/motion/anime";
import type { Navigation } from "@/lib/types";
import { useCart } from "./cart/CartProvider";
import { useWishlist } from "./WishlistProvider";

// Search UI is only needed once someone opens it.
const SearchDialog = dynamic(() => import("./SearchDialog").then((m) => m.SearchDialog), { ssr: false });

/** Search button with its dialog (left side of the header, as on Shopify themes). */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Search">
        <Icon name="search" />
      </button>
      {open ? <SearchDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function HeaderActions() {
  const { cart, openDrawer } = useCart();
  const { ids } = useWishlist();
  const countRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(0);
  const count = cart?.itemCount ?? 0;

  useEffect(() => {
    if (count > prevCount.current && countRef.current) {
      void animate(countRef.current, { scale: [1, 1.45, 1], duration: 520, ease: "outBack(1.4)" }, "essential");
    }
    prevCount.current = count;
  }, [count]);

  return (
    <div className="site-header__actions">
      <ThemeToggle className="hide-sm" />
      <Link href="/wishlist" className="icon-btn hide-sm" aria-label={`Wishlist, ${ids.length} saved`}>
        <Icon name="heart" />
        {ids.length ? <span className="icon-btn__count">{ids.length}</span> : null}
      </Link>
      <Link href="/account" className="icon-btn" aria-label="Account">
        <Icon name="user" />
      </Link>
      <button type="button" className="icon-btn" onClick={openDrawer} aria-label={`Open bag, ${count} item${count === 1 ? "" : "s"}`}>
        <Icon name="bag" />
        <span ref={countRef} className={`icon-btn__count ${count ? "" : "is-empty"}`} aria-hidden>
          {count}
        </span>
      </button>
    </div>
  );
}

export function MobileMenu({ navigation, storeName }: { navigation: Navigation; storeName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      void (async () => {
        const panel = d.querySelector(".mnav__panel");
        await animate(panel, { translateX: ["-100%", "0%"], duration: 480, ease: "outExpo" }, "essential");
        const delay = await stagger(40, { start: 80 });
        await animate(d.querySelectorAll(".mnav__item"), { opacity: [0, 1], translateY: [10, 0], duration: 380, delay, ease: "outQuart" });
      })();
    } else if (d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className="icon-btn show-sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <Icon name="menu" />
      </button>
      <dialog
        ref={ref}
        className="mnav"
        aria-label="Menu"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => e.target === ref.current && setOpen(false)}
      >
        <div className="mnav__panel">
          <div className="mnav__head">
            <Logo variant="horizontal" title={storeName} className="mnav__logo" />
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu">
              <Icon name="close" />
            </button>
          </div>
          <ul className="mnav__list">
            {navigation.main.map((item) => (
              <li key={item.id} className="mnav__item">
                <Link href={item.href} className="mnav__link">
                  {item.label}
                </Link>
                {item.children?.length ? (
                  <ul className="mnav__sub">
                    {item.children.map((c) => (
                      <li key={c.id}>
                        <Link href={c.href}>{c.label}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            <li className="mnav__item">
              <Link href="/wishlist" className="mnav__link">
                Wishlist
              </Link>
            </li>
            <li className="mnav__item">
              <Link href="/account" className="mnav__link">
                Account
              </Link>
            </li>
          </ul>
          <div className="mnav__foot">
            <span className="small muted">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </dialog>
    </>
  );
}
