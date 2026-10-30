"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadAnime, motionTier } from "@/lib/motion/anime";

export interface StageLook {
  key: string;
  src: string;
  alt: string;
  label: string;
  q: string;
  /** Where to focus the crop inside the tall arch. */
  focus?: string;
}

const HOLD_MS = 5200;

/**
 * Hero "stage": one tall arched photo that slowly cross-fades through the lookbook, a caption
 * card naming the current look, and round thumbnails with a progress ring. The ring's CSS
 * animation drives the timing (its end advances the slide), so pausing it on hover, focus,
 * off-screen or a hidden tab pauses the whole thing. With reduced motion nothing auto-plays;
 * the thumbnails still switch looks.
 */
export function HeroStage({ looks }: { looks: StageLook[] }) {
  const root = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hold, setHold] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const first = useRef(true);

  useEffect(() => {
    setAuto(motionTier() === "full" && looks.length > 1);
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(!!e?.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    const vis = () => setOnScreen(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [looks.length]);

  // Caption swap: a short rise-in with Anime.js (skipped on the first render and with reduced motion).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = caption.current;
    if (!el || motionTier() === "none") return;
    let stop: { pause(): unknown } | null = null;
    void loadAnime().then(({ animate, stagger }) => {
      stop = animate(el.querySelectorAll("[data-cap]"), { opacity: [0, 1], translateY: [14, 0], duration: 700, delay: stagger(70), ease: "outExpo" }) as unknown as { pause(): unknown };
    });
    return () => void stop?.pause();
  }, [active]);

  const go = useCallback((i: number) => setActive(((i % looks.length) + looks.length) % looks.length), [looks.length]);
  const look = looks[active]!;
  const paused = hold || !onScreen;

  return (
    <div
      ref={root}
      className={`hstage ${auto ? "is-auto" : ""} ${paused ? "is-paused" : ""}`}
      style={{ ["--hold" as string]: `${HOLD_MS}ms` }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      <div className="hstage__arch" data-depth="-4">
        <span className="hstage__halo" aria-hidden />
        <div className="hstage__frame">
          {looks.map((l, i) => (
            <div key={l.key} className={`hstage__slide ${i === active ? "is-on" : ""}`} aria-hidden={i !== active}>
              <Image src={l.src} alt={l.alt} fill priority={i === 0} sizes="(min-width: 1100px) 420px, (min-width: 900px) 36vw, 78vw" className="hstage__img" style={{ objectPosition: l.focus ?? "50% 40%" }} />
            </div>
          ))}
          <span className="hstage__shade" aria-hidden />
        </div>

        <svg className="hstage__badge" viewBox="0 0 120 120" aria-hidden data-depth="6">
          <defs>
            <path id="hstage-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
          </defs>
          <circle cx="60" cy="60" r="57" className="hstage__badge-bg" />
          <text className="hstage__badge-text">
            <textPath href="#hstage-ring" textLength="272" lengthAdjust="spacing">QUEEN LUXURY HAIR · WIGS · FRONTALS ·</textPath>
          </text>
          <path className="hstage__badge-crown" d="M44 68 L48 52 L55 60 L60 48 L65 60 L72 52 L76 68 Z" />
        </svg>

        <div ref={caption} className="hstage__card" aria-live="polite">
          <span className="hstage__count" data-cap>
            {String(active + 1).padStart(2, "0")} / {String(looks.length).padStart(2, "0")}
          </span>
          <span className="hstage__name script" data-cap>
            {look.label}
          </span>
          <Link href={`/search?q=${encodeURIComponent(look.q)}`} className="hstage__shop" data-cap>
            Shop this look <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <ul className="hstage__thumbs" aria-label="Choose a look">
        {looks.map((l, i) => (
          <li key={l.key}>
            <button type="button" className={`hstage__thumb ${i === active ? "is-on" : ""}`} aria-pressed={i === active} aria-label={`Show ${l.label}`} onClick={() => go(i)}>
              <span className="hstage__thumb-img">
                <Image src={l.src} alt="" fill sizes="64px" style={{ objectFit: "cover" }} />
              </span>
              <svg className="hstage__ring" viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="16.5" className="hstage__ring-track" />
                {i === active ? <circle key={`${active}`} cx="18" cy="18" r="16.5" className="hstage__ring-fill" pathLength={100} onAnimationEnd={() => go(active + 1)} /> : null}
              </svg>
              <span className="hstage__thumb-label">{l.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
