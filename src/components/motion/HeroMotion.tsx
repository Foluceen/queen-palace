"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { loadAnime, motionTier } from "@/lib/motion/anime";

/**
 * The homepage's choreographed entrance, then restrained depth.
 *
 * Markup contract (rendered by the server, fully visible without JS):
 *   [data-hero-word]  each headline word, inside an overflow-hidden mask
 *   [data-hero-fade]  sub copy, CTAs, stats (fade + rise)
 *   [data-hero-pop]   price tags (spring pop)
 *   [data-count]      numbers that count up from 0 (final value is in the HTML)
 *   [data-depth]      art layers; moves on scroll and with the pointer (desktop)
 *
 * Only transform and opacity are animated. Pointer parallax runs a rAF loop only
 * while easing toward the pointer and stops when settled; nothing loops forever.
 */
export function HeroMotion({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const tier = motionTier();
    if (tier === "none") return;

    let disposed = false;
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-word]"));
    const fades = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-fade]"));
    const pops = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-pop]"));
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]"));
    let timeline: { pause(): unknown } | null = null;

    const start = async () => {
      const { createTimeline, stagger, animate } = await loadAnime();
      if (disposed) return;
      timeline = createTimeline({ defaults: { ease: "outExpo" } })
        .add(words, { translateY: ["110%", "0%"], rotate: [4, 0], duration: 1100, delay: stagger(60) }, 0)
        .add(layers, { scale: [1.08, 1], duration: 1500, delay: stagger(140) }, 0)
        .add(fades, { opacity: [0, 1], translateY: [24, 0], duration: 850, delay: stagger(90) }, 480)
        .add(pops, { opacity: [0, 1], scale: [0.7, 1], duration: 900, delay: stagger(140), ease: "outBack(1.7)" }, 900);
      // Count-up once the stats are visible.
      window.setTimeout(() => {
        if (disposed) return;
        for (const el of counters) {
          const target = Number(el.dataset.count || 0);
          const obj = { v: 0 };
          animate(obj, {
            v: target,
            duration: 1600,
            ease: "outExpo",
            modifier: (v: number) => Math.round(v),
            onUpdate: () => {
              el.textContent = Math.round(obj.v).toLocaleString("en-NG");
            },
          });
        }
      }, 700);
    };
    if (tier === "full") void start();

    // Depth: scroll offset + pointer offset, combined in one transform per layer.
    let scrollY = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    let visible = true;
    const apply = () => {
      for (const l of layers) {
        const d = Number(l.dataset.depth || 0);
        l.style.translate = `${(cx * d * 0.25).toFixed(2)}px ${(scrollY * d * 0.01 + cy * d * 0.2).toFixed(2)}px`;
      }
    };
    const tick = () => {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      apply();
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = root.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    const onScroll = () => {
      const r = root.getBoundingClientRect();
      scrollY = Math.max(0, -r.top);
      kick();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(root);
    if (tier === "full" && layers.length) {
      window.addEventListener("scroll", onScroll, { passive: true });
      root.addEventListener("pointermove", onPointer);
      root.addEventListener("pointerleave", onLeave);
    }

    return () => {
      disposed = true;
      timeline?.pause();
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerleave", onLeave);
      [...words, ...fades, ...pops, ...layers].forEach((el) => {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.translate = "";
      });
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
