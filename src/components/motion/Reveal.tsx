"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, interrupt, motionTier, stagger, type Controllable } from "@/lib/motion/anime";

interface RevealProps {
  children: ReactNode;
  /** Selector for the items to animate inside the wrapper. Defaults to direct children. */
  items?: string;
  /** "rise": fade and lift. "fall": top-down wipe, used for imagery (hair falling). */
  variant?: "rise" | "fall";
  className?: string;
  as?: "div" | "section" | "ul" | "ol";
  /** Re-run the entrance when this value changes (e.g. a new filter result). */
  replayKey?: string | number;
}

/**
 * Scroll-triggered entrance. Content is visible by default; it is only hidden right
 * before animating, and only if it starts below the fold, so no-JS, reduced-motion and
 * low-end devices always see everything immediately.
 */
export function Reveal({ children, items, variant = "rise", className, as: Tag = "div", replayKey }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || motionTier() !== "full") return;
    const targets = Array.from(items ? root.querySelectorAll<HTMLElement>(items) : (root.children as HTMLCollectionOf<HTMLElement>));
    if (!targets.length) return;

    const isReplay = replayKey !== undefined && root.dataset.revealed === "1";
    const inView = root.getBoundingClientRect().top < window.innerHeight * 0.92;
    if (inView && !isReplay) return; // Above the fold on load: never delay first paint.

    let running: Controllable | null = null;
    let cancelled = false;
    const hidden = variant === "fall" ? { clipPath: "inset(0 0 100% 0)" } : { opacity: "0", transform: "translateY(18px)" };
    targets.forEach((t) => Object.assign(t.style, hidden));

    const run = async () => {
      const delay = await stagger(variant === "fall" ? 90 : 55);
      if (cancelled) return;
      running = await animate(
        targets,
        variant === "fall"
          ? { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"], duration: 1100, delay, ease: "inOutQuart" }
          : { opacity: [0, 1], translateY: [18, 0], duration: 700, delay, ease: "outQuart" },
      );
      root.dataset.revealed = "1";
      if (!running) targets.forEach((t) => t.removeAttribute("style"));
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void run();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(root);

    return () => {
      cancelled = true;
      io.disconnect();
      running?.pause();
      void interrupt(targets);
      targets.forEach((t) => {
        t.style.opacity = "";
        t.style.transform = "";
        t.style.clipPath = "";
      });
    };
  }, [items, variant, replayKey]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
