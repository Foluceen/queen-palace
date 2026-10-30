import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { HeroMotion } from "@/components/motion/HeroMotion";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { Monogram } from "@/components/brand/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { ProductCard } from "@/components/store/ProductCard";
import { Carousel } from "./Carousel";
import { isMockMode } from "@/lib/api/config";
import { whatsappHref } from "@/lib/contact";
import { CopyCode } from "./CopyCode";
import { Icon, type IconName } from "@/components/ui/Icon";
import type {
  CareTipsSection,
  Collection,
  FaqSection,
  NewsletterSection,
  PromoSection,
  TestimonialsSection,
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

/**
 * Full-bleed photo hero (Shopify "image banner"): the campaign photo fills the frame,
 * copy sits centred at the bottom over a soft shade, with a blush pill button. Up to two
 * circular insets show featured products (or the secondary image) like the reference.
 */
export function Hero({ section }: { section: HeroSection }) {
  const words = section.heading.split(/\s+/).filter(Boolean);
  const spotlight = (section.spotlight ?? []).filter((p) => p.image).slice(0, 2);
  const insets: { key: string; href: string | null; url: string; alt: string; label?: string }[] = spotlight.length
    ? spotlight.map((p) => ({ key: p.id, href: `/products/${p.handle}`, url: p.image!.url, alt: p.image!.alt, label: p.title }))
    : section.layerImage
      ? [{ key: "layer", href: null, url: section.layerImage.url, alt: section.layerImage.alt }]
      : [];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <HeroMotion className="hero__frame">
        {section.image ? (
          <div className="hero__media" data-depth="-20">
            <Image src={section.image.url} alt={section.image.alt} fill priority quality={65} sizes="100vw" className="hero__img" />
          </div>
        ) : null}
        <span className="hero__shade" aria-hidden />
        {insets.length ? (
          <div className="hero__insets">
            {insets.map((it, i) =>
              it.href ? (
                <Link key={it.key} href={it.href} className={`hero__inset hero__inset--${i}`} data-hero-pop aria-label={it.label}>
                  <Image quality={90} src={it.url} alt="" fill sizes="(min-width: 960px) 180px, 120px" />
                </Link>
              ) : (
                <span key={it.key} className={`hero__inset hero__inset--${i}`} data-hero-pop>
                  <Image quality={90} src={it.url} alt={it.alt} fill sizes="(min-width: 960px) 180px, 120px" />
                </span>
              ),
            )}
          </div>
        ) : null}
        <div className="hero__content container">
          <h1 id="hero-title" className="hero__title display">
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className="hero__word">
                  <span data-hero-word>{w}</span>
                </span>
                {i < words.length - 1 ? " " : null}
              </Fragment>
            ))}
          </h1>
          <p className="hero__body" data-hero-fade>
            {section.body}
          </p>
          <div className="hero__ctas" data-hero-fade>
            <Link href={section.primaryCta.href} className="btn btn--blush btn--lg hero__cta">
              {section.primaryCta.label}
            </Link>
            {section.secondaryCta ? (
              <Link href={section.secondaryCta.href} className="hero__link">
                {section.secondaryCta.label} <Icon name="chevronRight" size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      </HeroMotion>
      {section.stats?.length ? (
        <dl className="hero__stats container">
          {section.stats.map((s) => (
            <div key={s.label} className="hero__stat">
              <dd className="hero__stat-value">
                <span data-count={s.value}>{s.value.toLocaleString("en-NG")}</span>
                {s.suffix}
              </dd>
              <dt className="hero__stat-label">{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
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
    <section className="section circles-section" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <header className="section-head section-head--center">
          <h2 id={`${section.id}-title`} className="section-title">
            {section.heading}
          </h2>
          {section.body ? <p className="muted">{section.body}</p> : null}
        </header>
        <Reveal as="ul" className="circles" items="li">
          {collections.map((c) => (
            <li key={c.id}>
              <Link href={`/collections/${c.handle}`} className="circle">
                <span className="circle__glow" aria-hidden />
                <span className="circle__frame">
                  {c.image ? <Image quality={90} src={c.image.url} alt="" fill sizes="(min-width: 1100px) 220px, 42vw" className="circle__img" /> : null}
                  <span className="circle__shade" aria-hidden />
                  <span className="circle__label script">{c.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </Reveal>
        <p className="circles__all">
          <Link href="/collections" className="btn btn--ghost btn--sm">
            View all collections
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- product rail */

export function ProductRail({ section }: { section: ProductRailSection }) {
  if (!section.products?.length) return null;
  const href = section.href ?? "/search";
  return (
    <section className="section section--tight rail" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <header className="section-head section-head--center">
          <h2 id={`${section.id}-title`} className="section-title">
            {section.heading}
          </h2>
          {section.body ? <p className="muted">{section.body}</p> : null}
        </header>
        <Carousel label={section.heading}>
          {section.products.map((p) => (
            <ProductCard key={p.id} product={p} sizes="(min-width: 1100px) 22vw, (min-width: 640px) 40vw, 72vw" />
          ))}
        </Carousel>
        <p className="rail__all">
          <Link href={href} className="btn btn--ghost btn--sm">
            View all
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- editorial */

export function Editorial({ section }: { section: EditorialSection }) {
  return (
    <section className={`section editorial editorial--${section.imageSide}`} aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="editorial__grid">
          {section.image ? (
            <Reveal className="editorial__media" variant="fall">
              <div className="editorial__frame">
                <Image quality={90} src={section.image.url} alt={section.image.alt} fill sizes="(min-width: 900px) 50vw, 100vw" className="editorial__img" />
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
                <Link href={section.cta.href} className="btn btn--ghost">
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
        <header className="section-head">
          <h2 id={`${section.id}-title`} className="h2">
            {section.heading}
          </h2>
          {isMockMode ? <p className="badge badge--warning">Sample reviews (demo data)</p> : null}
        </header>
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
    <section className="features" aria-label="Why shop with us">
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
  const wa = section.whatsapp ? whatsappHref(settings, `Hi ${settings.name}, I'd like help choosing hair.`) : null;
  // WhatsApp is only used when a number is configured; otherwise the regular link applies.
  const href = wa ?? section.cta.href;
  const external = href.startsWith("http");
  return (
    <section className="section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="ctaband">
          <Monogram className="ctaband__mark" />
          <h2 id={`${section.id}-title`} className="h1 ctaband__title">
            {section.heading}
          </h2>
          <p className="lede">{section.body}</p>
          <a href={href} className={wa ? "btn btn--whatsapp" : "btn"} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {wa ? <Icon name="whatsapp" size={18} /> : null}
            {wa ? section.cta.label : section.cta.href === "/contact" ? "Contact us" : section.cta.label}
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- promo */

export function Promo({ section }: { section: PromoSection }) {
  const ends = section.endsAt ? new Date(section.endsAt) : null;
  return (
    <section className="section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className={`promo promo--${section.tone}${section.image ? " promo--media" : ""}`}>
          <div className="promo__text">
            <h2 id={`${section.id}-title`} className="h1 promo__title">
              {section.heading}
            </h2>
            <p className="promo__body">{section.body}</p>
            <div className="promo__actions">
              <Link href={section.cta.href} className="btn">
                {section.cta.label}
              </Link>
              {section.code ? <CopyCode code={section.code} /> : null}
            </div>
            {ends ? (
              <p className="small promo__ends">
                Ends {ends.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })}. Terms apply at checkout.
              </p>
            ) : section.code ? (
              <p className="small promo__ends">Applied and checked at checkout.</p>
            ) : null}
          </div>
          {section.image ? (
            <div className="promo__media">
              <Image quality={90} src={section.image.url} alt={section.image.alt} fill sizes="(min-width: 900px) 40vw, 100vw" className="promo__img" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- testimonials */

export function Testimonials({ section }: { section: TestimonialsSection }) {
  if (!section.items.length) return null;
  return (
    <section className="section testimonials" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <header className="section-head section-head--center">
          <Monogram className="testimonials__mark" />
          <h2 id={`${section.id}-title`} className="h1">
            {section.heading}
          </h2>
          {isMockMode ? <p className="badge badge--warning">Sample testimonials (demo data). Replace with real customer words.</p> : null}
        </header>
        <Reveal as="ul" className="testimonials__list" items="li">
          {section.items.map((t) => (
            <li key={t.id}>
              <figure className="testimonial">
                <blockquote>
                  <p>{t.quote}</p>
                </blockquote>
                <figcaption>
                  <span className="testimonial__name">{t.name}</span>
                  {t.location ? <span className="muted"> · {t.location}</span> : null}
                </figcaption>
              </figure>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- care tips */

export function CareTips({ section }: { section: CareTipsSection }) {
  return (
    <section className="section care" aria-labelledby={`${section.id}-title`}>
      <div className="container care__grid">
        <div className="care__intro">
          <p className="eyebrow">Hair care</p>
          <h2 id={`${section.id}-title`} className="h1">
            {section.heading}
          </h2>
          <p className="lede">{section.body}</p>
          {section.cta ? (
            <Link href={section.cta.href} className="btn btn--ghost">
              {section.cta.label}
            </Link>
          ) : null}
        </div>
        <Reveal as="ol" className="care__list" items="li">
          {section.tips.map((t, i) => (
            <li key={t.title} className="care__tip">
              <span className="care__num" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="h4">{t.title}</h3>
                <p className="muted">{t.body}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- faq */

export function Faq({ section }: { section: FaqSection }) {
  const items = (section.items ?? []).slice(0, section.limit || undefined);
  if (!items.length) return null;
  return (
    <section className="section section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container faq">
        <header className="faq__head">
          <h2 id={`${section.id}-title`} className="h1">
            {section.heading}
          </h2>
          <Link href="/faq" className="btn btn--ghost btn--sm">
            All questions
          </Link>
        </header>
        <div className="accordion">
          {items.map((q) => (
            <details key={q.question} className="accordion__item">
              <summary>
                {q.question}
                <Icon name="plus" size={18} className="accordion__icon" />
              </summary>
              <p className="accordion__body">{q.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- newsletter */

export function Newsletter({ section }: { section: NewsletterSection }) {
  return (
    <section className="section--tight" aria-labelledby={`${section.id}-title`}>
      <div className="container">
        <div className="newsband">
          <div>
            <h2 id={`${section.id}-title`} className="h2">
              {section.heading}
            </h2>
            <p className="muted">{section.body}</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
