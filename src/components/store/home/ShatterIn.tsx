"use client";

import { useEffect, useRef } from "react";
import { loadAnime } from "@/lib/motion/anime";

/**
 * Cinematic entrance for the hero portrait: glass-like triangular shards start scattered and
 * invisible, then ease in together and lock into her portrait (centre first), after which the
 * real <img> fades in and the shards are removed.
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
    const timers: number[] = [];
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
      const poses: { x: number; y: number; r: number; s: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!filled(c, r)) continue;
          const flip = (r + c) % 2 === 0;
          // Each triangle reaches 2px past its diagonal so neighbouring shards overlap: no seams.
          const tris = flip
            ? ["0 0, 100% 0, 100% 2px, 2px 100%, 0 100%", "calc(100% - 2px) 0, 100% 0, 100% 100%, 0 100%, 0 calc(100% - 2px)"]
            : ["0 0, 100% 0, 100% 100%, calc(100% - 2px) 100%, 0 2px", "0 0, 2px 0, 100% calc(100% - 2px), 100% 100%, 0 100%"];
          for (const poly of tris) {
            const p = document.createElement("div");
            p.className = "shatter__piece";
            Object.assign(p.style, {
              // Cells overlap their neighbours by 1px on every side.
              left: `${c * cw - 1}px`,
              top: `${r * ch - 1}px`,
              width: `${cw + 2}px`,
              height: `${ch + 2}px`,
              backgroundImage: src,
              backgroundSize: `${W}px ${H}px`,
              backgroundPosition: `${-(c * cw - 1)}px ${-(r * ch - 1)}px`,
              clipPath: `polygon(${poly})`,
            });
            // Start scattered and invisible, so the very first frame already shows loose shards.
            const px = c * cw + cw / 2 - W / 2;
            const py = r * ch + ch / 2 - H * 0.42;
            const len = Math.hypot(px, py) || 1;
            // Phones crop the banner tightly, so shards start closer to stay on screen.
            const force = (narrow ? 50 : 160) + Math.random() * (narrow ? 110 : 300);
            const jitter = narrow ? 40 : 90;
            const pose = { x: (px / len) * force + (Math.random() - 0.5) * jitter, y: (py / len) * force + (Math.random() - 0.5) * jitter, r: (Math.random() - 0.5) * 200, s: 0.5 + Math.random() * 0.4 };
            p.style.transform = `translateX(${pose.x}px) translateY(${pose.y}px) rotate(${pose.r}deg) scale(${pose.s})`;
            p.style.opacity = "0";
            poses.push(pose);
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
      // One continuous move: every shard eases in from its scattered pose and locks into place,
      // centre first, fading up as it travels. No burst, no snap.
      const DURATION = 1900;
      const STEP = 5;
      const tl = createTimeline({ defaults: { ease: "outQuart" } });
      tl.add(pieces, {
        translateX: (_?: unknown, i = 0) => [poses[i]!.x, 0],
        translateY: (_?: unknown, i = 0) => [poses[i]!.y, 0],
        rotate: (_?: unknown, i = 0) => [poses[i]!.r, 0],
        scale: (_?: unknown, i = 0) => [poses[i]!.s, 1],
        opacity: { from: 0, to: 1, duration: 1100, ease: "outQuad" },
        duration: DURATION,
        delay: stagger(STEP, { from: "center" }),
      }, 120);
      anims.push(tl as unknown as { pause(): unknown });
      // Fade the real photo in underneath while the last shards are settling (an outQuart move is
      // ~89% there at 42% of its time, and lands on the same picture), so the thin seams between shards are filled and the
      // hand-over from shards to photo can't be seen.
      timers.push(window.setTimeout(reveal, 120 + DURATION * 0.42 + pieces.length * STEP));
      tl.then?.(() => finish());
      // Fallback in case the timeline promise isn't available in this Anime build.
      timers.push(window.setTimeout(finish, 120 + DURATION + pieces.length * STEP + 200));
    };

    let finished = false;
    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      reveal();
      // The photo is already showing underneath: fade the shards away, then remove them.
      if (layer) layer.style.transition = "opacity 0.35s ease";
      if (layer) layer.style.opacity = "0";
      window.setTimeout(() => layer?.remove(), 400);
    };

    run().catch(reveal);
    return () => {
      cancelled = true;
      window.clearTimeout(guard);
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((a) => a.pause());
      layer?.remove();
      reveal();
    };
  }, []);

  return <div ref={ref} className="shatter-host" aria-hidden />;
}
