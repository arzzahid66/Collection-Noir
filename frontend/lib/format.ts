import type { PricingStatus } from "./types";

/**
 * Price display, section 09.
 *
 * Format is a pound sign, comma thousands separator, no decimal places.
 *
 * Nothing here rounds or reformats. Every launch price is already a round
 * number ending in zero, which is a business rule applied to the source data,
 * and rounding in the template could contradict what the console holds.
 */
export function formatPrice(pounds: number): string {
  return `£${pounds.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/**
 * Display copy, held here so it is one edit rather than several.
 *
 * Section 09 sets "Starting from £X,XXX" on category grids and allows either
 * that or "From £X,XXX" on product pages. The approved design sets "Starting
 * from" in both places, and the client has confirmed the approved design is
 * authoritative, so both prefixes read the same. Logged in
 * PENDING_CHANGES.md.
 */
const GRID_PREFIX = "Starting from";
const DETAIL_PREFIX = "Starting from";

function withPrefix(
  prefix: string,
  price: number | null,
  status: PricingStatus,
): string | null {
  // No price on application at launch. A piece without a confirmed price is
  // withheld from the site entirely rather than shown with a placeholder,
  // so this branch is reachable only if the rule is relaxed later.
  if (status === "poa") return "Price on application";
  if (price === null) return null;
  return `${prefix} ${formatPrice(price)}`;
}

/** Price as set on a category grid card. */
export function gridPrice(
  price: number | null,
  status: PricingStatus = "from",
): string | null {
  return withPrefix(GRID_PREFIX, price, status);
}

/** Price as set on a product page. */
export function detailPrice(
  price: number | null,
  status: PricingStatus = "from",
): string | null {
  return withPrefix(DETAIL_PREFIX, price, status);
}

/**
 * Lead time as plain text, never a badge.
 *
 * Section 08 holds it as a range of whole weeks, for example "12-16". The
 * hyphen is kept rather than expanded, which is how every mockup sets it.
 */
export function leadTime(weeks: string | null): string | null {
  if (!weeks) return null;
  return `${weeks} weeks`;
}

export function aspectClass(ratio: string): string {
  return ratio === "3-2" ? "ratio-3-2" : "ratio-4-5";
}

/**
 * Dimensions, spaced.
 *
 * Section 7.4.8 sets these as "120 x 80 x 30cm" and rules out
 * "120x80x30cm". Dimensions are free text on the product record, so whoever
 * is loading the catalogue may type a multiplication sign, an "x" with
 * spaces, or an "x" without. Normalising here rather than at the point of
 * entry means every existing record renders correctly without being edited,
 * and a future one cannot be entered wrongly enough to matter.
 *
 * The separator is only rewritten where it sits between two digits, so a
 * word containing an x is left alone: "Six drawers" stays "Six drawers".
 */
export function formatDimensions(value: string): string {
  return value
    .replace(/(\d)\s*[x×✕]\s*(?=\d)/gi, "$1 x ")
    .replace(/\s+/g, " ")
    .trim();
}
