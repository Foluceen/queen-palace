"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoopVideo } from "./LoopVideo";

/** The owner's product clips. The lineup (three wigs) is the centrepiece. */
const REELS = [
  { key: "pink", src: "/media/video/pink-body-wave.mp4", poster: "/media/video/pink-body-wave-poster.webp", title: "Pink Futura wig", note: "Soft, bouncy colour", alt: "Model showing a long pink Futura wig with soft waves" },
  { key: "lineup", src: "/media/video/lineup.mp4", poster: "/media/video/lineup-poster.webp", title: "The lineup", note: "Straight, wavy and deep curl", alt: "Three black wigs on mannequins: straight, body wave and deep curl" },
  { key: "curly", src: "/media/video/deep-curly.mp4", poster: "/media/video/deep-curly-poster.webp", title: "Pixie curls", note: "Full, defined curls", alt: "Long black pixie curls lace wig on a mannequin" },
];
const MIDDLE = 1;

/**
 * "See it move": three portrait clips. On wide screens they sit side by side with the lineup
 * larger in the middle; on phones they become a swipeable carousel that opens on the lineup.
 * Each clip plays only while mostly on screen (see LoopVideo).
 */
export function VideoReels() {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(MIDDLE);

  const cards = () => Array.from(track.current?.children ?? []) as HTMLElement[];
  const scrollToCard = (i: number, smooth = true) => {
    const el = track.current;
    const card = cards()[i];
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Phones: start on the middle clip. (On wide screens nothing scrolls, so this does nothing.)
    scrollToCard(MIDDLE, false);
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      cards().forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      setActive(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="section lux-reels" aria-labelledby="reels-title">
      <div className="container">
        <header className="lux-reels__head">
          <p className="lux-kicker">In motion</p>
          <h2 id="reels-title" className="lux-reels__title">
            See the hair <span className="script">move</span>
          </h2>
          <p className="lux-reels__lede">Real units from our shop, filmed up close.</p>
        </header>
      </div>
      <ul ref={track} className="lux-reels__track" aria-label="Product videos">
        {REELS.map((r, i) => (
          <li key={r.key} className={`lux-reels__card${i === MIDDLE ? " is-feature" : ""}${i === active ? " is-active" : ""}`}>
            <LoopVideo src={r.src} poster={r.poster} label={r.alt} className="lux-reels__video" threshold={0.6} />
            <div className="lux-reels__caption">
              <p className="lux-reels__name script">{r.title}</p>
              <p className="lux-reels__note">{r.note}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="container lux-reels__foot">
        <div className="lux-reels__dots" role="group" aria-label="Choose a video">
          {REELS.map((r, i) => (
            <button key={r.key} type="button" className={`lux-reels__dot${i === active ? " is-on" : ""}`} aria-label={`Show ${r.title}`} aria-pressed={i === active} onClick={() => scrollToCard(i)} />
          ))}
        </div>
        <Link href="/search?sort=newest" className="btn btn--blush">
          Shop the latest
        </Link>
      </div>
    </section>
  );
}
