import Image from "next/image";
import type { StoreSettings } from "@/lib/types";

/** Turns a profile URL into "@handle" for display. */
export function socialHandle(url: string): string {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    return seg ? `@${seg.replace(/^@/, "")}` : url;
  } catch {
    return url;
  }
}

function TikTokGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill="currentColor">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12V9.75a5.73 5.73 0 0 0-.78-.05 5.7 5.7 0 1 0 5.7 5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.2-1.48Z" />
    </svg>
  );
}
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Our own photos for the moving strip. */
const STRIP = [
  "/media/visit/bone-straight-model.webp",
  "/media/looks/futura-copper-wave.webp",
  "/media/video/lineup-poster.webp",
  "/media/looks/lace-hairline-hand.webp",
  "/media/visit/body-wave-duo.webp",
  "/media/video/pink-body-wave-poster.webp",
  "/media/looks/braid-extensions-rack.webp",
  "/media/video/deep-curly-poster.webp",
];

/**
 * "Follow the queen": TikTok and Instagram cards plus a slowly drifting strip of our photos.
 * Links come from the store settings (admin wins over the built-in defaults); a platform with no
 * link is simply left out. The strip pauses on hover and stands still with reduced motion.
 */
export function FollowUs({ settings }: { settings: StoreSettings }) {
  const cards = [
    settings.social.tiktok ? { key: "tiktok", name: "TikTok", url: settings.social.tiktok, note: "Try-ons, installs and hair in motion.", cta: "Follow on TikTok", Glyph: TikTokGlyph, pics: STRIP.slice(5, 8) } : null,
    settings.social.instagram ? { key: "instagram", name: "Instagram", url: settings.social.instagram, note: "New arrivals, styled looks and offers.", cta: "Follow on Instagram", Glyph: InstagramGlyph, pics: STRIP.slice(0, 3) } : null,
  ].filter((c): c is NonNullable<typeof c> => !!c);
  if (!cards.length) return null;
  const strip = [...STRIP, ...STRIP];

  return (
    <section className="section lux-follow" aria-labelledby="follow-title">
      <div className="container">
        <header className="lux-follow__head">
          <p className="lux-kicker">Stay in the loop</p>
          <h2 id="follow-title" className="lux-follow__title">
            Follow the <span className="script">queen</span>
          </h2>
          <p className="lux-follow__lede">New drops, try-ons and behind the scenes, every week.</p>
        </header>
        <ul className={`lux-follow__cards lux-follow__cards--${cards.length}`}>
          {cards.map(({ key, name, url, note, cta, Glyph, pics }) => (
            <li key={key}>
              <a href={url} target="_blank" rel="noopener noreferrer" className={`lux-follow__card lux-follow__card--${key}`}>
                <span className="lux-follow__stack" aria-hidden>
                  {pics.map((src, i) => (
                    <span key={src} className={`lux-follow__pic lux-follow__pic--${i}`}>
                      <Image src={src} alt="" fill sizes="140px" />
                    </span>
                  ))}
                </span>
                <span className="lux-follow__body">
                  <span className="lux-follow__icon">
                    <Glyph />
                  </span>
                  <span className="lux-follow__name">{name}</span>
                  <span className="lux-follow__handle">{socialHandle(url)}</span>
                  <span className="lux-follow__note">{note}</span>
                  <span className="btn btn--blush lux-follow__cta">{cta}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="lux-follow__strip" aria-hidden>
        <div className="lux-follow__track">
          {strip.map((src, i) => (
            <span key={i} className="lux-follow__tile">
              <Image src={src} alt="" fill sizes="180px" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
