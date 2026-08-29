import Link from "next/link";

import { aspectClass } from "@/lib/format";
import type { Category, ProductSummary } from "@/lib/types";

/**
 * A tile on the collection overview, one per category, per figure 2.
 *
 * The frame carries the ratio held on the category row, not a site wide
 * default, and the photograph sits inside it with background-size: contain.
 * Section 07.
 *
 * The homepage teaser uses the same tile with `teaser` set, which is the one
 * place the design sets the category name as a tracked eyebrow with a piece
 * named beneath it. Everywhere else the tile is the frame and the category
 * name, and nothing more. There is no "View" line under either form.
 *
 * On a teaser the photograph and the name both come from the same product
 * record, per section 4.3 of the correction brief, so the card cannot end up
 * naming one piece while showing another as the catalogue changes. Homepage
 * teasers frame at 4:5 regardless of the category ratio, per section 11.
 */
export function CategoryCard({
  category,
  teaser = false,
  piece = null,
}: {
  category: Category;
  /** Renders the homepage form: category as an eyebrow, piece named beneath. */
  teaser?: boolean;
  piece?: ProductSummary | null;
}) {
  const soon = category.status === "coming_soon";
  // The teaser shows the piece it names. Where a category has nothing
  // published yet the category cover stands in and the name falls back to the
  // category, so the grid never renders an empty line.
  const image = (teaser ? piece?.primary_image : null) ?? category.cover_image;
  const ratio = teaser ? "ratio-4-5" : aspectClass(category.aspect_ratio);

  const label = (teaser ? piece?.name : null) ?? category.name;

  const frame = (
    <>
      <div
        className={`category-image ${ratio}`}
        style={image ? { backgroundImage: `url(${image.url})` } : undefined}
        role="img"
        aria-label={image?.alt_text ?? label}
      >
        {/* A frame waiting on its photograph names what belongs in it, in
            the monospace of section 1.5, so an unfinished catalogue reads as
            unfinished rather than as a design with empty rectangles in it. */}
        {!image && (
          <span className="image-placeholder">{label.toUpperCase()}</span>
        )}
      </div>
      {teaser ? (
        <>
          <p className="category-card__eyebrow">{category.name}</p>
          <p className="category-card__name">{piece?.name ?? category.name}</p>
        </>
      ) : (
        <>
          <p className="category-card__name">{category.name}</p>
          {soon && <p className="category-card__view">In preparation</p>}
        </>
      )}
    </>
  );

  if (soon) {
    return <div className="category-card">{frame}</div>;
  }

  return (
    <Link href={`/collection/${category.slug}`} className="category-card">
      {frame}
    </Link>
  );
}
