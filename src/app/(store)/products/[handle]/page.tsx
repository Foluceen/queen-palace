import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { ProductGrid } from "@/components/store/ProductCard";
import { ProductExperience } from "@/components/store/product/ProductExperience";
import { Reviews } from "@/components/store/product/Reviews";
import { siteUrl } from "@/lib/api/config";
import { RecentlyViewed } from "@/components/store/product/RecentlyViewed";
import { whatsappNumber } from "@/lib/contact";
import { getProduct, getSettings, storefront } from "@/lib/data/storefront";
import { first, type RawSearchParams } from "@/lib/search-params";

export const revalidate = 60;

/** Shortens to a word boundary for meta descriptions. */
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,.;:]$/, "")}…`);

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await getProduct(handle);
  if (!data) return { title: "Product not found" };
  const p = data.product;
  const img = p.media[0];
  return {
    title: p.seo.title ?? p.title,
    description: p.seo.description ?? clip(`${p.subtitle}. ${p.description}`, 158),
    alternates: { canonical: `/products/${p.handle}` },
    openGraph: img ? { images: [{ url: img.url, width: img.width, height: img.height, alt: img.alt }] } : undefined,
  };
}

/**
 * Reviews are secondary: if they fail to load, the product still renders and the reviews
 * section says so with a retry. Nothing is substituted for the missing reviews.
 */
async function reviewsOrNull(productId: string) {
  try {
    return await storefront().reviews(productId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[product] reviews unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  const data = await getProduct(handle);
  if (!data) notFound();
  const { product, collections, related, attributes, productType } = data;
  const [reviews, settings] = await Promise.all([reviewsOrNull(product.id), getSettings()]);
  const details = attributes.filter((a) => a.group === "details");
  const care = attributes.filter((a) => a.group === "care");
  const usage = attributes.filter((a) => a.group === "usage");
  const img = product.media[0];
  const collection = collections[0];

  const paragraphs = (text: string) => text.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>);
  const attrBody = (a: (typeof attributes)[number]) =>
    a.kind === "list" ? (
      <ul>
        {a.value
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => (
            <li key={l}>{l}</li>
          ))}
      </ul>
    ) : (
      paragraphs(a.value)
    );
  // Shopify-style collapsible tabs under the buy box. Empty ones are left out.
  const tabs: { id: string; title: string; open?: boolean; content: React.ReactNode }[] = [
    { id: "description", title: "Description", open: true, content: paragraphs(product.description) },
    ...(details.length || productType
      ? [
          {
            id: "details",
            title: "Details",
            content: (
              <dl className="specs">
                {productType ? (
                  <div>
                    <dt>Type</dt>
                    <dd>{productType.name}</dd>
                  </div>
                ) : null}
                {details.map((a) => (
                  <div key={a.key}>
                    <dt>{a.label}</dt>
                    <dd>{a.value}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
        ]
      : []),
    ...[...usage, ...care].map((a) => ({
      id: a.key,
      title: a.label,
      content: (
        <>
          {attrBody(a)}
          {a.group === "care" ? (
            <p>
              <Link href="/hair-care">Read the full hair care guide</Link>
            </p>
          ) : null}
        </>
      ),
    })),
    ...(settings.productPageNotes.shipping ? [{ id: "delivery", title: "Delivery and pickup", content: paragraphs(settings.productPageNotes.shipping) }] : []),
    ...(settings.productPageNotes.returns
      ? [
          {
            id: "returns",
            title: "Returns",
            content: (
              <>
                {paragraphs(settings.productPageNotes.returns)}
                <p>
                  <Link href="/returns">Read the returns policy</Link>
                </p>
              </>
            ),
          },
        ]
      : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.media.map((m) => new URL(m.url, siteUrl).toString()),
    sku: product.variants[0]?.sku,
    aggregateRating: product.rating.count ? { "@type": "AggregateRating", ratingValue: product.rating.average, reviewCount: product.rating.count } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "NGN",
      lowPrice: product.priceRange.min / 100,
      highPrice: product.priceRange.max / 100,
      availability: product.availability === "out_of_stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container pdp-wrap">
        <ProductExperience
          product={product}
          initialVariantId={first(sp.variant) ?? null}
          collection={collection ? { handle: collection.handle, title: collection.title } : null}
          whatsappNumber={whatsappNumber(settings)}
          storeName={settings.name}
          notes={settings.productPageNotes}
          tabs={tabs}
        />
      </div>

      <div className="container">
        <Reviews productId={product.id} productTitle={product.title} initial={reviews} rating={product.rating} />
      </div>

      {related.length ? (
        <section className="container section--tight" aria-labelledby="related-title">
          <header className="section-head section-head--center">
            <h2 id="related-title" className="section-title">
              You may also like
            </h2>
          </header>
          <ProductGrid products={related} />
        </section>
      ) : null}

      <RecentlyViewed current={{ id: product.id, handle: product.handle, title: product.title, image: img ? { url: img.url, alt: img.alt } : null, priceMin: product.priceRange.min }} />
    </>
  );
}
