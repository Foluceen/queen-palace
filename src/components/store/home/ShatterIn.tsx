"use client";

import { useEffect, useRef } from "react";
import { loadAnime } from "@/lib/motion/anime";

/**
 * Cinematic entrance for the hero portrait: the photo holds for a beat, bursts into glass-like
 * triangular shards, then the shards fly back and lock together, after which the real <img>
 * fades back in and the shards are removed.
 *
 * Only runs when <html data-shatter> was set by the inline head script (homepage, motion
 * allowed). That script hides the photo before first paint; a CSS failsafe reveals it after
 * 4.5 s no matter what, and any problem here reveals it immediately. Everything is built
 * imperatively after hydration, so the server and client render the same empty <div>.
 */
export function ShatterIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    const wrap = host?.parentElement;
    const section = host?.closest<HTMLElement>(".lux-ed");
    const img = wrap?.querySelector<HTMLImageElement>(".lux-ed__img");
    if (!host || !wrap || !section || !img) return;
    const reveal = () => section.classList.add("is-formed");
    // Once per page load: coming back to the homepage later just shows the photo.
    const w = window as Window & { __qlhShatterDone?: boolean };
    if (document.documentElement.dataset.shatter !== "1" || w.__qlhShatterDone) return reveal();
    w.__qlhShatterDone = true;

    let cancelled = false;
    let layer: HTMLDivElement | null = null;
    const anims: { pause(): unknown }[] = [];
    const guard = window.setTimeout(reveal, 3200);

    const run = async () => {
      if (!img.complete || !img.naturalWidth) await img.decode().catch(() => undefined);
      await img.decode().catch(() => undefined);
      if (cancelled) return;
      const box = img.getBoundingClientRect();
      const base = wrap.getBoundingClientRect();
      const W = box.width;
      const H = box.height;
      if (W < 40 || H < 40) return reveal();

      // Which cells actually contain her (skip transparent ones): sample the cut-out's alpha.
      const narrow = W < 500;
      const cols = narrow ? 6 : 8;
      const rows = narrow ? 11 : 14;
      const probe = document.createElement("canvas");
      probe.width = cols * 4;
      probe.height = rows * 4;
      const pctx = probe.getContext("2d", { willReadFrequently: true });
      let alpha: Uint8ClampedArray | null = null;
      try {
        pctx?.drawImage(img, 0, 0, probe.width, probe.height);
        alpha = pctx?.getImageData(0, 0, probe.width, probe.height).data ?? null;
      } catch {
        alpha = null; // tainted or unsupported: keep every cell
      }
      const filled = (c: number, r: number) => {
        if (!alpha) return true;
        let sum = 0;
        for (let y = r * 4; y < r * 4 + 4; y++) for (let x = c * 4; x < c * 4 + 4; x++) sum += alpha[(y * probe.width + x) * 4 + 3]!;
        return sum / 16 > 10;
      };

      layer = document.createElement("div");
      layer.className = "shatter";
      layer.setAttribute("aria-hidden", "true");
      Object.assign(layer.style, { left: `${box.left - base.left}px`, top: `${box.top - base.top}px`, width: `${W}px`, height: `${H}px` });
      const src = `url("${img.currentSrc || img.src}")`;
      const cw = W / cols;
      const ch = H / rows;
      const pieces: HTMLDivElement[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!filled(c, r)) continue;
          const flip = (r + c) % 2 === 0;
          const tris = flip ? ["0 0, 100% 0, 0 100%", "100% 0, 100% 100%, 0 100%"] : ["0 0, 100% 0, 100% 100%", "0 0, 100% 100%, 0 100%"];
          for (const poly of tris) {
            const p = document.createElement("div");
            p.className = "shatter__piece";
            Object.assign(p.style, {
              left: `${c * cw - 0.5}px`,
              top: `${r * ch - 0.5}px`,
              width: `${cw + 1}px`,
              height: `${ch + 1}px`,
              backgroundImage: src,
              backgroundSize: `${W}px ${H}px`,
              backgroundPosition: `${-(c * cw - 0.5)}px ${-(r * ch - 0.5)}px`,
              clipPath: `polygon(${poly})`,
            });
            pieces.push(p);
            layer.appendChild(p);
          }
        }
      }
      if (!pieces.length || cancelled) return reveal();
      host.appendChild(layer);
      window.clearTimeout(guard); // started: the timeline below decides when to reveal

      const { stagger, createTimeline } = await loadAnime();
      if (cancelled) return;
      // Each shard flies away from the centre of the portrait, spinning.
      const cx = W / 2;
      const cy = H * 0.42;
      const out = pieces.map((p) => {
        const px = parseFloat(p.style.left) + cw / 2 - cx;
        const py = parseFloat(p.style.top) + ch / 2 - cy;
        const len = Math.hypot(px, py) || 1;
        // Phones crop the banner tightly, so shards stay closer to remain on screen.
        const force = (narrow ? 50 : 260) + Math.random() * (narrow ? 110 : 420);
        const jitter = narrow ? 50 : 120;
        return { x: (px / len) * force + (Math.random() - 0.5) * jitter, y: (py / len) * force + (Math.random() - 0.5) * jitter, r: (Math.random() - 0.5) * 300, s: 0.45 + Math.random() * 0.45 };
      });
      const tl = createTimeline({ defaults: { ease: "outExpo" } });
      // 1) Burst apart (the photo is shown whole for a beat first).
      tl.add(pieces, {
        translateX: (_?: unknown, i = 0) => out[i]!.x,
        translateY: (_?: unknown, i = 0) => out[i]!.y,
        rotate: (_?: unknown, i = 0) => out[i]!.r,
        scale: (_?: unknown, i = 0) => out[i]!.s,
        opacity: [1, 0.55],
        duration: 900,
        delay: stagger(4, { from: "center" }),
      }, 380);
      // 2) Fly back and lock together, centre first.
      tl.add(pieces, {
        translateX: 0,
        translateY: 0,
        rotate: 0,
        scale: 1,
        opacity: 1,
        duration: 1500,
        ease: "inOutQuart",
        delay: stagger(6, { from: "center" }),
      }, 1300);
      anims.push(tl as unknown as { pause(): unknown });
      tl.then?.(() => finish());
      // Fallback in case the timeline promise isn't available in this Anime build.
      window.setTimeout(finish, 1300 + 1500 + pieces.length * 6 + 200);
    };

    let finished = false;
    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      reveal();
      // Let the real photo fade in over the assembled shards, then remove them.
      window.setTimeout(() => layer?.remove(), 450);
    };

    run().catch(reveal);
    return () => {
      cancelled = true;
      window.clearTimeout(guard);
      anims.forEach((a) => a.pause());
      layer?.remove();
      reveal();
    };
  }, []);

  return <div ref={ref} className="shatter-host" aria-hidden />;
}
