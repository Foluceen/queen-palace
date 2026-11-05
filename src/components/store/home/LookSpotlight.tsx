"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motionTier } from "@/lib/motion/anime";

interface Look {
  src: string;
  alt: string;
  label: string;
}

/**
 * Cross-fades through a few photos with a light CSS transition, so it also runs on budget
 * phones. It only cycles while on screen and stops after a few rounds; with reduced motion
 * it shows the first photo.
 */
export function LookSpotlight({ looks, portrait = false }: { looks: Look[]; /** Taller 4:5 frame for portrait photos. */ portrait?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = ref.current;
    if (!root || looks.length < 2 || motionTier() === "none") return;
    let timer = 0;
    let steps = 0;
    const maxSteps = looks.length * 3;
    const io = new IntersectionObserver(([e]) => {
      window.clearInterval(timer);
      if (!e?.isIntersecting || steps >= maxSteps) return;
      timer = window.setInterval(() => {
        if (document.hidden) return;
        steps += 1;
        setActive((a) => (a + 1) % looks.length);
        if (steps >= maxSteps) window.clearInterval(timer);
      }, 4000);
    });
    io.observe(root);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [looks.length]);

  return (
    <div ref={ref} className={`lux-spotlight${portrait ? " lux-spotlight--portrait" : ""}`}>
      {looks.map((l, i) => (
        <div key={l.src} className={`lux-spotlight__slide${i === active ? " is-active" : ""}`} aria-hidden={i !== active}>
          <Image src={l.src} alt={l.alt} fill sizes="(min-width: 900px) 34vw, 90vw" quality={90} className="lux-spotlight__img" />
        </div>
      ))}
      <p className="lux-spotlight__label script" aria-live="off">
        {looks[active]?.label}
      </p>
    </div>
  );
}
