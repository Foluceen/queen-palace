"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/anime";

/**
 * A silent looping clip. Nothing is downloaded until it is near the screen; it pauses when
 * scrolled away, and shows only the still poster when the visitor prefers reduced motion or
 * has data saver on.
 */
export function LoopVideo({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // set as a property too: some browsers only autoplay when it is
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (prefersReducedMotion() || saveData) return;
    let loaded = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          if (!loaded) {
            v.src = src;
            loaded = true;
          }
          void v.play().catch(() => undefined);
        } else if (loaded) v.pause();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);

  return <video ref={ref} className={className} poster={poster} muted loop playsInline preload="none" aria-label={label} />;
}
