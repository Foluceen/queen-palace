import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { HeroMotion } from "@/components/motion/HeroMotion";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { ProductGrid } from "@/components/store/ProductCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatPriceRange } from "@/lib/format";
import type {
  Collection,
  CollectionsSection,
  CtaBandSection,
  EditorialSection,
  HeroSection,
  MarqueeSection,
  ProductRailSection,
  PromiseSection,
  ReviewsSection,
  ShadeGuideSection,
  StoreSettings,
} from "@/lib/types";

/* --------------------------------------------------------------------- hero */

export function Hero({ section }: { section: HeroSection }) {
  const words = section.heading.split(/\s+/).filter(Boolean);
  const spotlight = section.spotlight ?? [];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__glow hero__glow--pink" aria-hidden />
      <div className="hero__glow hero__glow--gold" aria-hidden />
      <HeroMotion className="hero__inner container">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title display">
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className="hero__word">
                  <span data-hero-word className={i >= words.length - 2 ? "glam-text" : undefined}>
                    {w}
                  </span>
                </span>
                {i < words.length - 1 ? " " : null}
              </Fragment>
            ))}
          </h1>
          <p className="hero__body" data-hero-fade>
            {section.body}
          </p>
          <div className="hero__ctas" data-hero-fade>
            <Link href={section.primaryCta.href} className="btn">
              {section.primaryCta.label}
            </Link>
            {section.secondaryCta ? (
              <Link href={section.secondaryCta.href} className="btn btn--ghost">
                {section.secondaryCta.label}
              </Link>
            ) : null}
          </div>
          {section.stats?.length ? (
            <dl className="hero__stats" data-hero-fade>
              {section.stats.map((s) => (
                <div key={s.label} className="hero__stat">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="hero__stat-value">
                      <span data-count={s.value}>{s.value.toLocaleString("en-NG")}</span>
                      {s.suffix}
                    </span>
                    <span className="hero__stat-label" aria-hidden>
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="hero__art">
          {section.image ? (
            <div className="hero__card hero__card--back" data-depth="-40">
              <Image src={section.image.url} alt={section.image.alt} fill priority quality={62} sizes="(min-width: 960px) 34vw, 70vw" className="hero__img" />
            </div>
          ) : null}
          {section.layerImage ? (
            <div className="hero__card hero__card--front" data-depth="60">
              <Image src={section.layerImage.url} alt={section.layerImage.alt} fill sizes="(min-width: 960px) 22vw, 46vw" className="hero__img" />
            </div>
          ) : null}
          {spotlight.map((p, i) => (
            <Link key={p.id} href={`/products/${p.handle}`} className={`hero__tag hero__tag--${i}`} data-hero-pop data-depth={i === 0 ? "90" : "-70"}>
              <span className="hero__tag-title">{p.title}</span>
              <span className="hero__tag-price">{formatPriceRange(p.priceRange)}</span>
            </Link>
          ))}
        </div>
      </HeroMotion>
    </section>
  );
}

export function MarqueeBand({ section }: { section: MarqueeSection }) {
  return <Marquee items={section.items} />;
}

/* -------------------------------------------------------------- collections */

export function CollectionTiles({ section, collections }: { section: CollectionsSection; collections: Collection[] }) {
  if (!collections.length) return null;
  return (
    <section className="section" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <header className="section-head">
          <h2 id={`${section.id}-title`} className="h1">
            {section.heading}
          </h2>
          {section.body ? <p className="lede">{section.body}</p> : null}
        </header>
        <Reveal className="bento" items="[data-tile]">
          {collections.map((c, i) => (
            <Link key={c.id} href={`/collections/${c.handle}`} className={`bento__tile bento__tile--${i}`} data-tile>
              {c.image ? <Image src={c.image.url} alt="" fill sizes={i === 0 ? "(min-width: 900px) 46vw, 92vw" : "(min-width: 900px) 26vw, 46vw"} className="bento__img" /> : null}
              <span className="bento__scrim" aria-hidden />
              <span className="bento__text">
                <span className="bento__title">{c.title}</span>
                <span className="bento__summary">{c.summary}</span>
                <span className="bento__cta">
                  Shop now <Icon name="chevronRight" size={16} />
                </span>
              </span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- product rail */

export function ProductRail({ section }: { section: ProductRailSection }) {
  if (!section.products?.length) return null;
  const href = section.source.kind === "newest" ? "/search?sort=newest" : "/search";
  return (
    <section className="section section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <header className="section-head section-head--row">
          <div>
            <h2 id={`${section.id}-title`} className="h2">
              {section.heading}
            </h2>
            {section.body ? <p className="muted">{section.body}</p> : null}
          </div>
          <Link href={href} className="btn btn--ghost btn--sm">
            Shop all
          </Link>
        </header>
        <ProductGrid products={section.products} className="pgrid--rail" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- editorial */

export function Editorial({ section }: { section: EditorialSection }) {
  return (
    <section className={`section editorial editorial--${section.imageSide}`} aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="editorial__card">
          {section.image ? (
            <Reveal className="editorial__media" variant="fall">
              <div className="editorial__frame">
                <Image src={section.image.url} alt={section.image.alt} fill sizes="(min-width: 900px) 50vw, 100vw" className="editorial__img" />
              </div>
            </Reveal>
          ) : null}
          <Reveal className="editorial__text" items="[data-reveal-item]">
            <h2 id={`${section.id}-title`} className="h1" data-reveal-item>
              {section.heading}
            </h2>
            <p className="lede" data-reveal-item>
              {section.body}
            </p>
            {section.cta ? (
              <span data-reveal-item>
                <Link href={section.cta.href} className="btn btn--gold">
                  {section.cta.label}
                </Link>
              </span>
            ) : null}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- shade guide */

export function ShadeGuide({ section }: { section: ShadeGuideSection }) {
  return (
    <section className="section shades" aria-labelledby={`${section.id}-title`}>
      <div className="container shades__grid">
        <div className="shades__intro">
          <h2 id={`${section.id}-title`} className="h1">
            {section.heading}
          </h2>
          <p className="lede">{section.body}</p>
        </div>
        <Reveal as="ul" className="shades__list" items="li">
          {section.shades.map((s) => (
            <li key={s.code}>
              <Link href={`/search?q=${encodeURIComponent(s.code)}`} className="shade">
                <span className="shade__strand" style={{ backgroundColor: s.hex }} aria-hidden />
                <span className="shade__code">{s.code}</span>
                <span className="shade__name">{s.name}</span>
              </Link>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ reviews */

export function ReviewsStrip({ section }: { section: ReviewsSection }) {
  if (!section.reviews?.length) return null;
  return (
    <section className="section section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <h2 id={`${section.id}-title`} className="h2 section-head">
          {section.heading}
        </h2>
        <Reveal as="ul" className="quotes" items="li">
          {section.reviews.slice(0, 3).map((r) => (
            <li key={r.id}>
              <figure className="quote">
                <span className="quote__stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                  {"★★★★★".slice(0, r.rating)}
                </span>
                <blockquote>
                  <p>{r.body}</p>
                </blockquote>
                <figcaption>
                  <span className="quote__author">{r.author}</span>
                  {r.location ? <span className="muted">, {r.location}</span> : null}
                  <span className="quote__product">on {r.productTitle}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- promises */

const promiseIcon = (title: string): IconName => {
  const t = title.toLowerCase();
  if (t.includes("pay")) return "receipt";
  if (t.includes("return")) return "box";
  if (t.includes("deliver") || t.includes("ship")) return "truck";
  return "check";
};

export function Promises({ section }: { section: PromiseSection }) {
  return (
    <section className="section--tight" aria-label="Our promises">
      <Reveal as="ul" className="container trust" items="li">
        {section.items.map((p) => (
          <li key={p.title} className="trust__item">
            <span className="trust__icon">
              <Icon name={promiseIcon(p.title)} size={22} />
            </span>
            <div>
              <h3 className="trust__title">{p.title}</h3>
              <p className="small muted">{p.body}</p>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ cta band */

export function CtaBand({ section, settings }: { section: CtaBandSection; settings: StoreSettings }) {
  const wa = settings.whatsapp.replace(/\D/g, "");
  const href = section.whatsapp && wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${settings.name}, I'd like help choosing hair.`)}` : section.cta.href;
  const external = href.startsWith("http");
  return (
    <section className="section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="ctaband">
          <div className="ctaband__glow" aria-hidden />
          <h2 id={`${section.id}-title`} className="h1 ctaband__title">
            {section.heading}
          </h2>
          <p className="lede">{section.body}</p>
          <a href={href} className="btn" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {section.whatsapp ? <Icon name="chat" size={18} /> : null}
            {section.cta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
