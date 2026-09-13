import Link from "next/link";

import type { ImageRef } from "@/lib/types";

/**
 * Full bleed hero with the copy overlaid, section 4.1.
 *
 * One photograph, held still. There is no carousel, no crossfade and no
 * arrows: the specification sets a single frame, and a hero that moves is the
 * loudest thing on a site whose whole register is restraint. Where the
 * atelier has attached more than one hero photograph the first is shown and
 * the rest wait for an editor to reorder them in the console.
 *
 * The frame is a div carrying a background image rather than an img, because
 * a hero fills its viewport band and cover is correct here. This is the one
 * place on the site cover is used on a photograph of a piece; the category
 * grid letterboxes and never crops.
 */
export function Hero({
  eyebrow,
  headline,
  headlineItalic,
  headlineTail,
  note,
  frames,
}: {
  eyebrow: string;
  headline: string;
  headlineItalic: string;
  headlineTail: string;
  /** The italic line at the foot of the hero, above the collection link. */
  note: string;
  frames: ImageRef[];
}) {
  const frame = frames[0] ?? null;

  return (
    /*
     * data-has-frame drives the overlay wash. With no photograph the hero is
     * the bare letterbox mount, and a gradient over it would read as a
     * styling error rather than as a slot waiting on its asset.
     */
    <section className="hero" data-has-frame={frame !== null} aria-label="Collection Noir">
      {frame && (
        <div
          className="hero__frame"
          style={{ backgroundImage: `url(${frame.url})` }}
          role="img"
          aria-label={frame.alt_text ?? "Collection Noir"}
        />
      )}

      {/* The empty slot says so. Every other frame on the site names itself
          when it has no photograph attached; the hero was the one that did
          not, so with nothing supplied it read as a blank band rather than as
          a slot waiting on its asset. Marked presentational: it is a note to
          whoever is loading the catalogue, not content. */}
      {!frame && (
        <span className="image-placeholder hero__placeholder" role="presentation">
          HERO PHOTOGRAPH
        </span>
      )}

      <div className="hero__inner">
        {/* Left, vertically centred, 48px from the edge. */}
        <div className="hero__lead">
          <p className="eyebrow hero__eyebrow">{eyebrow}</p>
          <h1>
            {headline} <em>{headlineItalic}</em>
            <br />
            {headlineTail}
          </h1>
        </div>

        {/* Bottom right, 48px in and 44px up, right aligned. */}
        <div className="hero__aside">
          <p className="hero__tagline">{note}</p>
          <Link href="/collection" className="tracked-link">
            View the Collection
          </Link>
        </div>
      </div>
    </section>
  );
}
