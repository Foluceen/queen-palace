"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "@/lib/motion/anime";

let firstMount = true;

/**
 * Soft entrance between routes. Used from template.tsx, which remounts on navigation.
 * Skipped on the initial page load so it never delays first paint or LCP.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firstMount) {
      firstMount = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    let handle: { pause(): unknown } | null = null;
    void animate(el, { opacity: [0.001, 1], translateY: [8, 0], duration: 420, ease: "outQuart" }, "essential").then((h) => (handle = h));
    return () => {
      handle?.pause();
      el.style.opacity = "";
      el.style.transform = "";
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
