import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { storefront } from "@/lib/data/storefront";

export const revalidate = 300;

/** Content pages managed by the backend (about, care guide, FAQ, policies). */
const SLUGS = ["about", "hair-care", "faq", "shipping", "returns", "privacy", "terms"];

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = SLUGS.includes(slug) ? await storefront().page(slug) : null;
  return page ? { title: page.title, description: page.intro, alternates: { canonical: `/${slug}` } } : { title: "Page not found" };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUGS.includes(slug)) notFound();
  const page = await storefront().page(slug);
  if (!page) notFound();
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
    </article>
  );
}
