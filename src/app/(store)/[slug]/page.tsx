import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { getSettings, storefront } from "@/lib/data/storefront";
import { mailHref, telHref, whatsappHref } from "@/lib/contact";
import { POLICY_PAGES } from "@/lib/policies";
import Link from "next/link";

export const revalidate = 300;

/**
 * Content pages (about, care guide, FAQ, policies). The backend's version is used when it has
 * one; otherwise the store's built-in page from lib/policies.ts.
 */
const SLUGS = ["about", "hair-care", "faq", "shipping", "returns", "privacy", "terms"];

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function loadPage(slug: string) {
  let fromBackend = null;
  try {
    fromBackend = await storefront().page(slug);
  } catch (err) {
    // The built-in page is still correct; don't fail the policy page because the API is down.
    console.error(`[page] ${slug} from backend unavailable:`, err instanceof Error ? err.message : err);
  }
  return fromBackend ?? POLICY_PAGES[slug] ?? null;
}

const POLICY_LINKS = [
  { slug: "terms", label: "Terms and conditions" },
  { slug: "privacy", label: "Privacy policy" },
  { slug: "returns", label: "Refund and cancellation policy" },
  { slug: "shipping", label: "Shipping and delivery policy" },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = SLUGS.includes(slug) ? await loadPage(slug) : null;
  return page ? { title: page.title, description: page.intro, alternates: { canonical: `/${slug}` } } : { title: "Page not found" };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUGS.includes(slug)) notFound();
  const [page, settings] = await Promise.all([loadPage(slug), getSettings()]);
  if (!page) notFound();
  const tel = telHref(settings.phone);
  const mail = mailHref(settings.contactEmail);
  const wa = whatsappHref(settings, `Hi ${settings.name}, I have a question.`);
  const isFaq = page.blocks.some((b) => b.kind === "qa");

  return (
    <article className="container section--tight content-page">
      <header className="page-head">
        <h1 className="h1">{page.title}</h1>
        <p className="lede">{page.intro}</p>
        {!page.reviewed ? (
          <p className="notice notice--info small" role="note">
            This page is still being finalised by the store. For anything specific to your order, please contact us.
          </p>
        ) : null}
      </header>
      <div className={isFaq ? "accordion" : "prose"}>
        {page.blocks.map((b, i) => {
          switch (b.kind) {
            case "heading":
              return <h2 key={i}>{b.text}</h2>;
            case "paragraph":
              return <p key={i}>{b.text}</p>;
            case "list":
              return (
                <ul key={i}>
                  {b.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              );
            case "qa":
              return (
                <details key={i} className="accordion__item">
                  <summary>
                    {b.question}
                    <Icon name="plus" size={18} className="accordion__icon" />
                  </summary>
                  <p className="accordion__body">{b.answer}</p>
                </details>
              );
            default:
              return null;
          }
        })}
      </div>

      <section className="prose content-page__contact" aria-labelledby="page-contact">
        <h2 id="page-contact">Contact us</h2>
        <p>
          <strong>{settings.name}</strong>
          <br />
          {settings.address}
        </p>
        <ul>
          {tel ? (
            <li>
              Phone: <a href={tel}>{settings.phone}</a>
            </li>
          ) : null}
          {mail ? (
            <li>
              Email: <a href={mail}>{settings.contactEmail}</a>
            </li>
          ) : null}
          {wa ? (
            <li>
              WhatsApp:{" "}
              <a href={wa} target="_blank" rel="noopener noreferrer">
                message us
              </a>
            </li>
          ) : null}
          <li>
            Or send us a message on our <Link href="/contact">contact page</Link>.
          </li>
        </ul>
        {page.updatedAt ? <p className="small muted">Last updated {new Date(page.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })}.</p> : null}
        <nav aria-label="Store policies" className="small">
          {POLICY_LINKS.filter((l) => l.slug !== slug).map((l, i) => (
            <span key={l.slug}>
              {i ? " · " : ""}
              <Link href={`/${l.slug}`}>{l.label}</Link>
            </span>
          ))}
        </nav>
      </section>
    </article>
  );
}
