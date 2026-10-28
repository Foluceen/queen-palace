"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolling strip. Pure CSS transform animation, paused whenever the strip is off
 * screen or the tab is hidden, and replaced by a static wrap under reduced motion.
 */
export function Marquee({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-running", !!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (!items.length) return null;
  return (
    <div ref={ref} className="marquee" aria-label={items.join(", ")} role="region">
      <div className="marquee__track" aria-hidden>
        {[0, 1].map((copy) => (
          <ul key={copy} className="marquee__group">
            {items.map((t, i) => (
              <li key={`${copy}-${i}`}>
                <span>{t}</span>
                <svg viewBox="0 0 24 24" width="16" height="16" className="marquee__star">
                  <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
                </svg>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
