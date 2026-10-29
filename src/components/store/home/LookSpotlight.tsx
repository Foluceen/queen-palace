"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { loadAnime, motionTier } from "@/lib/motion/anime";

interface Look {
  src: string;
  alt: string;
  label: string;
}

/**
 * Cross-fades through the lookbook with Anime.js. It only cycles while on screen, with full
 * motion allowed, and stops for good after a few rounds. Otherwise it shows the first look.
 */
export function LookSpotlight({ looks }: { looks: Look[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = ref.current;
    if (!root || looks.length < 2 || motionTier() !== "full") return;
    let timer = 0;
    let visible = false;
    let steps = 0;
    const maxSteps = looks.length * 3;
    let current = 0;

    const step = async () => {
      if (!visible || document.hidden || steps >= maxSteps) return;
      const { animate } = await loadAnime();
      const slides = root.querySelectorAll<HTMLElement>("[data-look]");
      const next = (current + 1) % looks.length;
      const from = slides[current];
      const to = slides[next];
      if (!from || !to) return;
      animate(to, { opacity: [0, 1], scale: [1.08, 1], duration: 1400, ease: "outQuart" });
      animate(from, { opacity: [1, 0], duration: 1100, ease: "inOutQuad" });
      current = next;
      steps += 1;
      setActive(next);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      window.clearInterval(timer);
      if (visible && steps < maxSteps) timer = window.setInterval(() => void step(), 3600);
    });
    io.observe(root);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [looks.length]);

  return (
    <div ref={ref} className="lux-spotlight">
      {looks.map((l, i) => (
        <div key={l.src} data-look className="lux-spotlight__slide" style={{ opacity: i === 0 ? 1 : 0 }} aria-hidden={i !== active}>
          <Image src={l.src} alt={l.alt} fill sizes="(min-width: 900px) 34vw, 90vw" className="lux-spotlight__img" />
        </div>
      ))}
      <p className="lux-spotlight__label script" aria-live="off">
        {looks[active]?.label}
      </p>
    </div>
  );
}
