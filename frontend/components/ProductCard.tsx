import Link from "next/link";

import { aspectClass, gridPrice } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";

/**
 * A single card in a category grid, per figures 4 to 8.
 *
 * The frame is shaped by the ratio held on the product's category, never by a
 * global default, and the photograph sits inside it with background-size:
 * contain. An image whose native ratio does not match its frame is centred on
 * the mount colour with clean margin. Nothing is cropped. Section 07.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  const image = product.primary_image;
  const price = gridPrice(product.price_from, product.pricing_status);

  return (
    <Link
      href={`/collection/${product.category_slug}/${product.slug}`}
      className="category-card"
    >
      <div
        className={`category-image ${aspectClass(product.aspect_ratio)}`}
        style={image ? { backgroundImage: `url(${image.url})` } : undefined}
        role="img"
        aria-label={
          image?.alt_text ??
          `${product.name}, ${product.subtitle ?? product.category_name}`
        }
      >
        {!image && (
          <span className="image-placeholder">{product.name.toUpperCase()}</span>
        )}
      </div>
      <p className="category-card__eyebrow">
        {product.subtitle ?? product.category_name}
      </p>
      <p className="category-card__name">{product.name}</p>
      {price && <p className="category-card__price">{price}</p>}
      <p className="category-card__cta">Enquire</p>
    </Link>
  );
}
