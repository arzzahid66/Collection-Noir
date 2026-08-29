"use client";

import { useState } from "react";

import type { ProductImageLink } from "@/lib/types";

/**
 * The photograph on a product page, with the rest of the shots beneath it.
 *
 * The approved design sets a row of small frames under the main image and
 * swaps the main image when one is chosen. The strip only appears where the
 * atelier has attached more than one photograph, so a piece with a single shot
 * carries no control that does nothing.
 *
 * Every frame letterboxes on the mount colour and is never cropped, section
 * 07, which is why these are background images at the category's ratio rather
 * than img elements sized to fill.
 */
export function ProductGallery({
  images,
  ratio,
  alt,
}: {
  images: ProductImageLink[];
  ratio: string;
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const shown = images[index] ?? images[0];
  if (!shown) return null;

  return (
    <>
      <div
        className={`product__image ${ratio}`}
        style={{ backgroundImage: `url(${shown.image.url})` }}
        role="img"
        aria-label={shown.image.alt_text ?? alt}
      />

      {images.length > 1 && (
        <ul className="product__shots">
          {images.map((link, position) => (
            <li key={link.id}>
              <button
                type="button"
                className="product__shot"
                data-current={position === index}
                style={{ backgroundImage: `url(${link.image.url})` }}
                onClick={() => setIndex(position)}
                aria-label={`Show photograph ${position + 1} of ${images.length}`}
                aria-pressed={position === index}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
