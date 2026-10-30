import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { Carousel } from "@/components/store/home/Carousel";
import { ProductCard } from "@/components/store/ProductCard";
import { HeroMotion } from "@/components/motion/HeroMotion";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { LookSpotlight } from "@/components/store/home/LookSpotlight";
import { HeroStage } from "@/components/store/home/HeroStage";
import { mapsHref } from "@/lib/contact";
import type { ProductCard as Card, StoreSettings } from "@/lib/types";

/**
 * Brand sections that never call the API: they render the same whether the catalogue is
 * empty or full. Photography is the owner's own lookbook (public/media/looks). Nothing
 * here states prices, stock, ratings or other business facts.
 */
export const LOOKS = [
  { key: "balayage", src: "/media/looks/ash-balayage-wave.jpg", label: "Balayage", q: "balayage", focus: "45% 35%", alt: "Ash blonde balayage wig with soft waves, styled on a mannequin by a fountain" },
  { key: "frontal", src: "/media/looks/lace-frontal-hairline.jpg", label: "Frontal", q: "frontal", focus: "50% 30%", alt: "Close-up of a lace frontal hairline with a soft middle part" },
  { key: "curly", src: "/media/looks/chocolate-kinky-curly.jpg", label: "Curly", q: "curly", focus: "55% 40%", alt: "Chocolate brown kinky curly lace wig with a full, voluminous shape" },
  { key: "body-wave", src: "/media/looks/copper-body-wave.jpg", label: "Body wave", q: "body wave", focus: "50% 45%", alt: "Long copper body wave wig seen from the back" },
] as const;

function townOf(address: string): string | null {
  const m = address.match(/\b(Ilesha|Ilesa)\b/i);
  return m ? m[0] : null;
}

export function LuxHero({ settings }: { settings: StoreSettings }) {
  const town = townOf(settings.address);
  const words = ["Hair", "that", "wears", "like"];
  return (
    <section className="hero lux-hero" aria-labelledby="lux-hero-title">
      <div className="lux-hero__glow" aria-hidden />
      <HeroMotion className="container lux-hero__inner">
        <div className="lux-hero__copy">
          <p className="lux-eyebrow" data-hero-fade>
            <span className="lux-eyebrow__rule" aria-hidden />
            {settings.name}
            {town ? ` · ${town}` : ""}
          </p>
          <h1 id="lux-hero-title" className="lux-hero__title">
            {words.map((w) => (
              <Fragment key={w}>
                <span className="hero__word">
                  <span data-hero-word>{w}</span>
                </span>{" "}
              </Fragment>
            ))}
            <span className="lux-hero__last">
              <span className="hero__word">
                <span data-hero-word>a</span>
              </span>{" "}
              <span className="hero__word lux-hero__crown">
                <span data-hero-word className="script">
                  crown.
                </span>
              </span>
            </span>
          </h1>
          <p className="lux-hero__body" data-hero-fade>
            Wigs, frontals, closures and bundles, chosen to look like you on your best day. Shop online{town ? ` or visit the store in ${town}` : ""}.
          </p>
          <div className="lux-hero__ctas" data-hero-fade>
            <Link href="/collections" className="btn btn--blush btn--lg">
              Shop the collection
            </Link>
            <Link href="#looks" className="btn btn--ghost btn--lg lux-btn-ghost">
              Find your look
            </Link>
          </div>
        </div>

        <div className="lux-hero__art" data-hero-fade>
          <HeroStage looks={LOOKS.map(({ key, src, alt, label, q, focus }) => ({ key, src, alt, label, q, focus }))} />
        </div>
      </HeroMotion>
    </section>
  );
}

export function LuxMarquee({ town }: { town: string | null }) {
  const items = ["Wigs", "Lace frontals", "Closures", "Bundles", "Hair care", ...(town ? [`Visit us in ${town}`] : [])];
  return <Marquee items={items} />;
}

export function LuxLooks() {
  return (
    <section id="looks" className="section lux-looks" aria-labelledby="looks-title">
      <div className="container">
        <header className="section-head section-head--center">
          <p className="lux-kicker">The lookbook</p>
          <h2 id="looks-title" className="section-title">
            Shop by look
          </h2>
        </header>
        <Reveal as="ul" className="circles circles--four" variant="fall">
          {LOOKS.map((look) => (
            <li key={look.key}>
              <Link href={`/search?q=${encodeURIComponent(look.q)}`} className="circle">
                <span className="circle__glow" aria-hidden />
                <span className="circle__frame">
                  <Image src={look.src} alt={look.alt} fill sizes="(min-width: 1100px) 22vw, (min-width: 700px) 30vw, 44vw" className="circle__img" />
                  <span className="circle__shade" aria-hidden />
                  <span className="circle__label script">{look.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** Live products when there are any; otherwise an honest "being added" panel. */
export function LuxArrivals({ products, settings }: { products: Card[] | null; settings: StoreSettings }) {
  if (products && products.length) {
    return (
      <section className="section section--tight rail" aria-labelledby="new-in-title">
        <div className="container">
          <header className="section-head section-head--center">
            <p className="lux-kicker">Just listed</p>
            <h2 id="new-in-title" className="section-title">
              New in
            </h2>
          </header>
          <Carousel label="New in">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} sizes="(min-width: 1100px) 22vw, (min-width: 640px) 40vw, 72vw" />
            ))}
          </Carousel>
          <p className="rail__all">
            <Link href="/collections" className="btn btn--ghost btn--sm">
              View all
            </Link>
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="section section--tight" aria-labelledby="arriving-title">
      <div className="container">
        <Reveal className="lux-arriving">
          <p className="lux-kicker">The collection</p>
          <h2 id="arriving-title" className="lux-arriving__title">
            New units are <span className="script">being added</span>
          </h2>
          <p className="lux-arriving__body">
            Products appear here as soon as they are listed. Want something specific? Send us a message and we&apos;ll tell you what&apos;s available
            {settings.address ? ", or come and see it in person" : ""}.
          </p>
          <div className="lux-arriving__ctas">
            <Link href="/contact" className="btn btn--blush">
              Ask what&apos;s available
            </Link>
            {settings.address ? (
              <a href={mapsHref(settings.address)} className="btn btn--ghost lux-btn-ghost" target="_blank" rel="noopener noreferrer">
                Get directions
              </a>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LuxStandard() {
  const points = [
    { title: "Lace that blends", body: "Ask us to show you the hairline up close before you buy, in store or on a video call." },
    { title: "Help choosing", body: "Length, density and lace size explained in plain words, so the unit suits your face and budget." },
    { title: "Your way", body: "Collect from the store or choose delivery at checkout." },
  ];
  return (
    <section className="section lux-standard" aria-labelledby="standard-title">
      <div className="container lux-standard__grid">
        <Reveal className="lux-standard__media" variant="fall">
          <div className="lux-standard__frame">
            <Image src="/media/looks/lace-frontal-hairline.jpg" alt="Close-up of a lace frontal hairline with a soft middle part" fill sizes="(min-width: 900px) 40vw, 90vw" className="lux-standard__img" />
          </div>
          <div className="lux-standard__chip">
            <Image src="/media/looks/copper-body-wave.jpg" alt="" fill sizes="140px" className="lux-standard__img" />
          </div>
        </Reveal>
        <div className="lux-standard__copy">
          <p className="lux-kicker">The Queen standard</p>
          <h2 id="standard-title" className="lux-standard__title">
            Made to be <span className="script">seen</span> up close
          </h2>
          <Reveal as="ol" className="lux-points">
            {points.map((p, i) => (
              <li key={p.title} className="lux-point">
                <span className="lux-point__num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="lux-point__title">{p.title}</h3>
                  <p className="muted">{p.body}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function LuxVisit({ settings }: { settings: StoreSettings }) {
  if (!settings.address) return null;
  return (
    <section className="section section--tight" aria-labelledby="visit-title">
      <div className="container">
        <Reveal className="lux-visit">
          <LookSpotlight looks={LOOKS.map(({ src, alt, label }) => ({ src, alt, label }))} />
          <div className="lux-visit__copy">
            <p className="lux-kicker">Visit the store</p>
            <h2 id="visit-title" className="lux-visit__title">
              Try it on in <span className="script">person</span>
            </h2>
            <address className="lux-visit__address">{settings.address}</address>
            {settings.openingHours ? <p className="muted">{settings.openingHours}</p> : null}
            <div className="lux-arriving__ctas">
              <a href={mapsHref(settings.address)} className="btn btn--blush" target="_blank" rel="noopener noreferrer">
                Get directions
              </a>
              <Link href="/contact" className="btn btn--ghost lux-btn-ghost">
                Contact us
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
