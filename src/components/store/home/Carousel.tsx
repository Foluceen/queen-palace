"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Horizontal product carousel (Shopify "featured collection" slider). Native scroll with
 * snap points, so touch, trackpad and keyboard all work; the arrows only scroll by a page.
 */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <ul className="carousel__track" ref={track} tabIndex={0}>
        {Children.map(children, (child) => (
          <li className="carousel__slide">{child}</li>
        ))}
      </ul>
      <div className="carousel__nav">
        <button type="button" className="carousel__btn" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous products">
          <Icon name="chevronLeft" size={18} />
        </button>
        <button type="button" className="carousel__btn" onClick={() => page(1)} disabled={edges.end} aria-label="Next products">
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </div>
  );
}
