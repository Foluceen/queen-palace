import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/motion/Reveal";
import { availabilityLabel } from "@/lib/format";
import type { ProductCard as Card } from "@/lib/types";
import { WishlistButton } from "./WishlistProvider";

export function ProductCard({ product, priority = false, sizes = "(min-width: 1100px) 25vw, (min-width: 640px) 33vw, 50vw" }: { product: Card; priority?: boolean; sizes?: string }) {
  const soldOut = product.availability === "out_of_stock";
  const swatch = product.swatches;
  return (
    <article className={`pcard ${soldOut ? "is-sold-out" : ""}`} data-card>
      <Link href={`/products/${product.handle}`} className="pcard__link">
        <div className="pcard__media">
          {product.image ? (
            <Image src={product.image.url} alt={product.image.alt} fill sizes={sizes} priority={priority} className="pcard__img" />
          ) : (
            <div className="pcard__placeholder" aria-hidden />
          )}
          {product.hoverImage ? <Image src={product.hoverImage.url} alt="" fill sizes={sizes} className="pcard__img pcard__img--hover" aria-hidden /> : null}
          {product.badges.length ? (
            <div className="pcard__badges">
              {product.badges.map((b) => (
                <span key={b} className={`badge ${b === "Sold out" ? "badge--ink" : b === "Sale" ? "badge--gold" : "badge--pink"}`}>
                  {b}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="pcard__body">
          <h3 className="pcard__title">{product.title}</h3>
          <p className="pcard__sub">{product.subtitle}</p>
          <div className="pcard__meta">
            <Price range={product.priceRange} compareRange={product.compareAtPriceRange} />
            {product.availability === "low_stock" ? <span className="pcard__stock">{availabilityLabel.low_stock}</span> : null}
          </div>
          {swatch ? (
            <p className="pcard__options">
              <span className="sr-only">{swatch.option} options: </span>
              {swatch.values.length > 4 ? `${swatch.values[0]} to ${swatch.values[swatch.values.length - 1]}` : swatch.values.join(", ")}
            </p>
          ) : null}
        </div>
      </Link>
      <WishlistButton productId={product.id} title={product.title} className="pcard__wish" />
    </article>
  );
}

export function ProductGrid({ products, replayKey, priorityCount = 0, className }: { products: Card[]; replayKey?: string; priorityCount?: number; className?: string }) {
  return (
    <Reveal className={`pgrid ${className ?? ""}`} items="[data-card]" replayKey={replayKey}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </Reveal>
  );
}
