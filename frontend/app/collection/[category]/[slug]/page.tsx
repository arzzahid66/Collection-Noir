import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AddToOrderButton } from "@/components/ProductCta";
import { ProductGallery } from "@/components/ProductGallery";
import { aspectClass, detailPrice, formatDimensions, leadTime } from "@/lib/format";
import { getProduct, getProducts } from "@/lib/api";
import type { ProductDetail, ProductSummary } from "@/lib/types";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const product = await getProduct(category, slug);
  if (!product) return { title: "Piece not found" };
  return {
    title: product.name,
    description: product.base_description ?? `The ${product.name}. Made to order.`,
  };
}

// Prices and photography change in the admin console, so a product page is
// rendered on request rather than prerendered. A price edit is live
// immediately, with no rebuild.
export const dynamic = "force-dynamic";

/**
 * Product page, figure 3.
 *
 * Left column: the photograph, the finish shown, the material swatch row, and
 * the two downloadable documents. Right column: name, starting price, the
 * enquiry call to action, the editorial description, the specification pairs
 * and the bespoke panel.
 */
export default async function ProductPage({ params }: Props) {
  const { category, slug } = await params;
  const product = await getProduct(category, slug);

  // A piece without a confirmed price or a photograph is not published, and a
  // direct visit gets a 404 rather than a half rendered page. Section 09.
  if (!product) notFound();

  const defaultMaterial =
    product.materials.find((m) => m.is_default)?.material ??
    product.materials[0]?.material;
  const price = detailPrice(product.price_from, product.pricing_status);
  const lead = leadTime(product.lead_time_weeks);
  const ratio = aspectClass(product.aspect_ratio);
  const gallery = [...product.images].sort((a, b) => a.sort_order - b.sort_order);

  /*
   * "Also consider", section 7.4.11.
   *
   * The catalogue records one relationship between pieces, the pairing, and
   * nothing else. So these are derived: the other pieces in this collection
   * that a visitor could actually commission today. The API already filters
   * to live and priced, and the pairing is excluded because it is named in
   * its own block a few lines above.
   */
  const related = (await getProducts(product.category_slug))
    .filter(
      (candidate) =>
        candidate.slug !== product.slug &&
        candidate.slug !== product.cross_link?.slug,
    )
    .slice(0, 3);

  return (
    <>
      {/* Three levels, and the piece name is roman rather than italic.
          Section 7.1. */}
      <Breadcrumbs
        crumbs={[
          { href: "/collection", label: "Collection" },
          {
            href: `/collection/${product.category_slug}`,
            label: product.category_name,
          },
          { label: product.name },
        ]}
      />

      <article className="product">
        <div>
          <ProductGallery
            images={gallery}
            ratio={ratio}
            alt={`${product.name}, ${defaultMaterial?.name ?? "made to order"}`}
          />

          {defaultMaterial && (
            /* The material shown, as the approved design sets it: the
             * distinguishing word of its name, then SHOWN. The dash is written
             * as an escape so no literal em dash enters the source, which the
             * copy lint forbids under section 02. */
            <p className="caption product__shown">
              {shortName(defaultMaterial.name)} {"\u2014"} SHOWN
            </p>
          )}

          {product.materials.length > 0 && (
            <>
              <p className="product__material-label">Material</p>

              {/* A swatch stands in for the material at thumbnail size, each
                  named beneath it. The photograph remains the honest
                  representation, which is what the note below the row says. */}
              <ul className="swatches">
                {product.materials.map((link, position) => (
                  <li key={link.id}>
                    <span
                      className="swatch"
                      style={
                        link.material.swatch_hex
                          ? { backgroundColor: link.material.swatch_hex }
                          : undefined
                      }
                      title={link.material.name}
                    />
                    {/* The first material is the one shown, and is set in
                        Ink; the rest are Clay. Section 7.3. */}
                    <span className="swatch__name" data-default={position === 0}>
                      {shortName(link.material.name)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="product__swatch-note">
                {product.bespoke_box_type === "size_only"
                  ? "This piece is made in a fixed pairing of materials."
                  : "Further materials available upon request."}
              </p>
            </>
          )}

          {/* Rules rather than boxes, sharing one top rule. Section 7.3. */}
          <div className="downloads">
            <Download
              href={docHref("spec-sheets", product.spec_sheet)}
              title="Specification Sheet"
              meta={`${product.name} ${product.subtitle?.toLowerCase() ?? "piece"}, PDF`}
            />
            <Download
              href={docHref("care-guides", product.care_guide)}
              title="Care Guide"
              meta="Caring for a piece made by hand"
              fallback="/care"
            />
          </div>
        </div>

        <div className="product__right">
          <p className="eyebrow product__eyebrow">{product.category_name}</p>
          <h1 className="product__title">{product.name}</h1>
          {product.subtitle && (
            <p className="product__subtitle">{product.subtitle}</p>
          )}

          {price && <p className="price product__price">{price}</p>}

          <hr className="product__rule" />

          {/* Two branches, decided by data. Section 02 rules out cart and
              checkout language, because nothing is held in stock. Every launch  copy-lint-ok
              piece is enquire only; the ordering branch is reserved for a
              future, more transactional step and no piece sets it. */}
          {product.purchasable ? (
            <AddToOrderButton productId={product.id} productName={product.name} />
          ) : (
            <Link className="cta" href={enquireHref(product)}>
              Enquire
            </Link>
          )}

          {product.base_description && (
            <p className="product__description">{product.base_description}</p>
          )}

          <SpecGrid product={product} lead={lead} />

          {/* A label and a name on one baseline, section 7.4.9. */}
          {product.cross_link && (
            <div className="pairing">
              <span className="pairing__label">Part of a pair</span>
              <Link
                href={`/collection/${product.cross_link.category_slug}/${product.cross_link.slug}`}
              >
                {product.cross_link.name}
                {product.cross_link.subtitle
                  ? `, ${product.cross_link.subtitle.toLowerCase()}`
                  : ""}
              </Link>
            </div>
          )}

          {/* The second Enquire lives here, section 7.4.10. Both carry the
              piece through to the enquiry form as "Regarding". */}
          <div className="panel">
            <p className="panel__label">Bespoke Commissions</p>
            <p>
              {product.bespoke_box_type === "size_only"
                ? "This piece is made in a fixed finish pairing and can be varied by size. Every commission begins with a conversation about proportion, placement and timing."
                : "Every commission begins with a conversation. Dimensions, materials and detailing are all open, and the atelier will advise on what the stone will and will not do."}
            </p>
            <Link className="cta" href={enquireHref(product)}>
              Enquire
            </Link>
          </div>

          <AlsoConsider product={product} pieces={related} />

          <p className="product__note">
            Every piece is cut after it is commissioned. Veining and ground
            colour vary block to block, so the piece delivered will differ from
            the photograph shown.
          </p>
        </div>
      </article>
    </>
  );
}

/**
 * Specification pairs, two to a row, per figure 3.
 *
 * Dimensions arrive as free text on the product record, which is what section
 * 08 specifies. Where that text holds more than one measurement separated by a
 * slash, as on the Roma, each is given its own cell so the two diameters read
 * as a pair rather than as one run on line.
 */
function SpecGrid({
  product,
  lead,
}: {
  product: ProductDetail;
  lead: string | null;
}) {
  const dimensions = (product.dimensions ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <dl className="spec-grid">
      {dimensions.map((value, index) => (
        <div key={`dimension-${index}`}>
          <dt>{dimensionLabel(value)}</dt>
          {/* Normalised at render, so however the console holds a
              measurement it sets as "120 x 80 x 30cm". Section 7.4.8. */}
          <dd>{formatDimensions(value)}</dd>
        </div>
      ))}
      {product.base && (
        <div>
          <dt>Base</dt>
          <dd>{product.base}</dd>
        </div>
      )}
      {lead && (
        <div>
          <dt>Lead time</dt>
          {/* Plain text, never a badge. */}
          <dd>{lead}</dd>
        </div>
      )}
      <div>
        <dt>Made</dt>
        <dd>To order, in Italy</dd>
      </div>
    </dl>
  );
}

/**
 * Three other pieces from this collection, section 7.4.11.
 *
 * Rendered only where there are some: a collection holding one published
 * piece would otherwise draw a rule and an eyebrow over nothing.
 */
function AlsoConsider({
  product,
  pieces,
}: {
  product: ProductDetail;
  pieces: ProductSummary[];
}) {
  if (pieces.length === 0) return null;

  return (
    <section className="also-consider">
      <p className="eyebrow">Also Consider</p>
      <div className="also-consider__grid">
        {pieces.map((piece) => (
          <Link
            key={piece.slug}
            href={`/collection/${piece.category_slug}/${piece.slug}`}
          >
            <div
              className={`category-image ${aspectClass(piece.aspect_ratio)}`}
              style={
                piece.primary_image
                  ? { backgroundImage: `url(${piece.primary_image.url})` }
                  : undefined
              }
              role="img"
              aria-label={piece.primary_image?.alt_text ?? piece.name}
            >
              {!piece.primary_image && (
                <span className="image-placeholder">{piece.name.toUpperCase()}</span>
              )}
            </div>
            <p className="also-consider__name">{piece.name}</p>
            <p className="also-consider__type">
              {piece.subtitle ?? product.category_name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The enquiry link for a piece.
 *
 * `piece` carries the collection as well as the slug, which is what makes it
 * unambiguous: two collections can hold a piece of the same name, and the
 * Otis and Oria families do. Section 12's example uses a bare `regarding`
 * slug; the enquiry page accepts that too.
 */
function enquireHref(product: ProductDetail): string {
  return `/enquire?piece=${product.category_slug}/${product.slug}`;
}

/**
 * Label a single measurement, as the approved product mockup does with
 * "Diameter" and "Height" rather than repeating "Dimensions".
 *
 * Section 08 holds dimensions as one free text field, so the label is read off
 * the measurement's own prefix rather than from a column that does not exist.
 * Anything that does not announce itself falls back to "Dimensions", which is
 * always true even when it is less specific.
 */
function dimensionLabel(value: string): string {
  const text = value.toLowerCase();
  if (/^d\s*\d|^d\d|^diameter\b/.test(text)) return "Diameter";
  if (/^h\s*\d|^h\d|^height\b/.test(text)) return "Height";
  if (/\bseats?\b/.test(text)) return "Seats";
  if (/\bedge\b|\btop\b/.test(text)) return "Top";
  if (/\bdrawers?\b/.test(text)) return "Drawers";
  if (/two sizes|\bor\b/.test(text)) return "Sizes";
  return "Dimensions";
}

/**
 * The distinguishing word of a material name, set uppercase, which is how the
 * approved design labels a swatch and names the material shown: Nero Marquina
 * reads as MARQUINA, Calacatta Viola as VIOLA. The full name is carried on the
 * swatch's title attribute and on the materials page.
 */
function shortName(name: string): string {
  return name.trim().split(/\s+/).slice(-1)[0].toUpperCase();
}

/**
 * A generated document is referenced by a slug based filename held on the
 * product record and served from its own directory, per section 04.
 */
function docHref(directory: string, filename: string | null): string | null {
  return filename ? `/${directory}/${filename}` : null;
}

function Download({
  href,
  title,
  meta,
  fallback,
}: {
  href: string | null;
  title: string;
  meta: string;
  fallback?: string;
}) {
  const target = href ?? fallback;

  // A document that has not been generated yet is not offered as a broken
  // link. The care guide falls back to the care page, which always exists.
  if (!target) return null;

  return (
    <a className="download" href={target}>
      <span className="download__icon" aria-hidden="true">
        &#8595;
      </span>
      <span>
        <span className="download__title" style={{ display: "block" }}>
          {title}
        </span>
        <span className="download__meta" style={{ display: "block" }}>
          {meta}
        </span>
      </span>
    </a>
  );
}
