import { cache } from "react";

import pages from "./pages.json";
import type {
  AspectRatio,
  Category,
  CrossLink,
  ImageRef,
  Material,
  MaterialFamily,
  Page,
  ProductDetail,
  ProductSummary,
} from "./types";

/**
 * Public catalogue client for the Collection Noir API (`/api/v1`).
 *
 * The API speaks its own wire format: slugs rather than numeric ids, "3/2"
 * ratios, a price object, images as responsive derivative sets. The site's
 * components were written against `./types`, so everything is translated here,
 * at one boundary, and nothing past this file knows the wire shape.
 *
 * Server side requests go straight to the API. Browser requests go through the
 * Next.js rewrite at /api, which keeps every request same origin.
 */
const SERVER_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

function url(path: string): string {
  return typeof window === "undefined" ? `${SERVER_BASE}/api/v1${path}` : `/api/v1${path}`;
}

/**
 * Fetch that tolerates the API being unreachable.
 *
 * A page must still render when the backend is down, otherwise a missing
 * connection turns every route into a crash rather than an empty catalogue.
 */
async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(url(path), {
      // Everything is editable from the admin console, so nothing here is
      // cached across requests.
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// --- wire shapes -------------------------------------------------------------

interface WireImage {
  id: string;
  width: number;
  height: number;
  fallback: string;
  sources?: { type: string; srcset: string }[];
}

interface WireCategory {
  slug: string;
  name: string;
  description: string;
  ratio: string;
  productCount: number;
  image: WireImage | null;
}

interface WireProductCard {
  slug: string;
  name: string;
  subtitle: string;
  category: string;
  price: { from: number | null; currency: string; onApplication: boolean };
  lead: string;
  ratio: string;
  image: WireImage | null;
}

interface WireStoneRef {
  slug: string | null;
  name: string;
  group: string;
  attributes: string;
  swatch: string;
  description: string;
  image: WireImage | null;
  shown: boolean;
}

interface WireProductDetail extends WireProductCard {
  description: string;
  dimensions: string;
  base: string;
  stone_refs: WireStoneRef[];
  fixedFinish: boolean;
  pair: { slug: string; name: string; subtitle: string } | null;
  related: WireProductCard[];
  gallery: WireImage[];
}

interface WireMaterial {
  slug: string;
  name: string;
  group: string;
  attributes: string;
  swatch: string;
  description: string;
  image: WireImage | null;
}

interface WireSite {
  slots: Record<string, { image: WireImage | null; gallery: WireImage[] }>;
  homepage: { teasers: { category: string; product: string | null }[] };
}

// --- translation ---------------------------------------------------------------

/**
 * The API addresses everything by slug and has no numeric ids. The components
 * use `id` for React keys and to attach an enquiry to a piece, so a stable
 * number is derived from the slug (FNV-1a, kept positive).
 */
function idFor(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 1;
}

function toRatio(ratio: string): AspectRatio {
  return ratio === "3/2" ? "3-2" : "4-5";
}

function toImage(image: WireImage | null | undefined): ImageRef | null {
  if (!image?.fallback) return null;
  return {
    id: idFor(image.id),
    filename: image.id,
    mime_type: "image/jpeg",
    width: image.width,
    height: image.height,
    byte_size: 0,
    alt_text: null,
    url: image.fallback,
  };
}

/**
 * Bespoke prompts for a short category grid. The API does not carry this
 * copy, so it is held here, as the console last set it.
 */
const BESPOKE_PROMPTS: Record<string, string> = {
  "dining-tables": "Looking for a table at a specific length or in another material?",
  "coffee-tables": "Looking for a low table in a specific size or material?",
  "console-tables": "Looking for a console in a specific length or material?",
  "side-tables": "Looking for a side table at a different height?",
  "bedside-tables": "Looking for a bedside piece in a specific size or material?",
  plinths: "Need a different height or footprint?",
};

function toCategory(category: WireCategory, position: number): Category {
  return {
    id: idFor(`category:${category.slug}`),
    slug: category.slug,
    name: category.name,
    aspect_ratio: toRatio(category.ratio),
    sort_order: position,
    // The API lists only public collections. One with nothing published in it
    // yet is shown as in preparation rather than linking to an empty grid.
    status: category.productCount > 0 ? "live" : "coming_soon",
    intro_copy: category.description || null,
    bespoke_prompt: BESPOKE_PROMPTS[category.slug] ?? null,
    product_count: category.productCount,
    cover_image: toImage(category.image),
  };
}

/** The API sets lead time as "12-16 weeks"; the site holds the range alone. */
function toLeadWeeks(lead: string): string | null {
  const range = lead.replace(/\s*weeks?\s*$/i, "").trim();
  return range || null;
}

function toSummary(
  product: WireProductCard,
  categoryNames: Map<string, string>,
  position: number,
): ProductSummary {
  return {
    id: idFor(`product:${product.slug}`),
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle || null,
    price_from: product.price.from,
    pricing_status: product.price.onApplication ? "poa" : "from",
    purchasable: false,
    status: "live",
    sort_order: position,
    category_slug: product.category,
    category_name: categoryNames.get(product.category) ?? product.category,
    aspect_ratio: toRatio(product.ratio),
    primary_image: toImage(product.image),
  };
}

const FAMILY: Record<string, MaterialFamily> = {
  Stone: "marble",
  Timber: "timber",
  Metal: "metal",
};

function toMaterial(material: WireMaterial | WireStoneRef, position: number): Material {
  // "Marble · Italy": the place is the part after the middot.
  const [, place] = material.attributes.split(/\s*·\s*/);
  return {
    id: idFor(`material:${material.slug ?? material.name}`),
    slug: material.slug ?? "",
    name: material.name,
    family: FAMILY[material.group] ?? "marble",
    description: material.description || null,
    finish: null,
    quarry: null,
    region: null,
    origin: place ?? "",
    sort_order: position,
    image: toImage(material.image),
    swatch_hex: material.swatch || null,
  };
}

// --- reads -------------------------------------------------------------------------

const fetchCategories = cache(async (): Promise<Category[]> => {
  const body = await get<{ categories: WireCategory[] }>("/categories");
  return (body?.categories ?? []).map(toCategory);
});

async function categoryNames(): Promise<Map<string, string>> {
  const categories = await fetchCategories();
  return new Map(categories.map((c) => [c.slug, c.name]));
}

export function getCategories(): Promise<Category[]> {
  return fetchCategories();
}

export async function getCategory(slug: string): Promise<Category | null> {
  const [body, categories] = await Promise.all([
    get<WireCategory>(`/categories/${encodeURIComponent(slug)}`),
    fetchCategories(),
  ]);
  if (!body) return null;
  const position = categories.findIndex((c) => c.slug === slug);
  return toCategory(body, Math.max(position, 0));
}

/** Only live, priced pieces: the API applies the visibility gate. */
export async function getProducts(categorySlug?: string): Promise<ProductSummary[]> {
  const query = categorySlug
    ? `?category=${encodeURIComponent(categorySlug)}&limit=500`
    : "?limit=500";
  const [body, names] = await Promise.all([
    get<{ products: WireProductCard[] }>(`/products${query}`),
    categoryNames(),
  ]);
  return (body?.products ?? []).map((p, i) => toSummary(p, names, i));
}

export async function getProduct(
  categorySlug: string,
  productSlug: string,
): Promise<ProductDetail | null> {
  const [product, names] = await Promise.all([
    get<WireProductDetail>(`/products/${encodeURIComponent(productSlug)}`),
    categoryNames(),
  ]);
  // Slugs are unique across the catalogue, but the URL names the collection
  // too, and a piece reached under the wrong one is a 404, not a duplicate.
  if (!product || product.category !== categorySlug) return null;

  const summary = toSummary(product, names, 0);
  const photographs = product.gallery.length
    ? product.gallery
    : product.image
      ? [product.image]
      : [];

  // The material shown comes first; the site treats position 0 as the default.
  const stones = [...product.stone_refs].sort((a, b) => Number(b.shown) - Number(a.shown));

  let crossLink: CrossLink | null = null;
  if (product.pair) {
    // The pair is resolved by the API only when the partner is published, but
    // it does not say which collection the partner sits in.
    const partner = await get<WireProductCard>(
      `/products/${encodeURIComponent(product.pair.slug)}`,
    );
    if (partner) {
      crossLink = {
        slug: product.pair.slug,
        name: product.pair.name,
        subtitle: product.pair.subtitle || null,
        category_slug: partner.category,
        category_name: names.get(partner.category) ?? partner.category,
      };
    }
  }

  return {
    ...summary,
    base_description: product.description || null,
    base: product.base || null,
    dimensions: product.dimensions || null,
    lead_time_weeks: toLeadWeeks(product.lead),
    bespoke_box_type: product.fixedFinish ? "size_only" : "standard",
    cross_link_slug: product.pair?.slug ?? null,
    cross_link: crossLink,
    // Generated documents ship with the site under slug based filenames.
    spec_sheet: `${product.slug}-spec-sheet.pdf`,
    care_guide: "collection-noir-care-guide.pdf",
    images: photographs.flatMap((photo, i) => {
      const image = toImage(photo);
      return image
        ? [{ id: i + 1, role: i === 0 ? "primary" : "detail", sort_order: i, image } as const]
        : [];
    }),
    related: (product.related ?? []).map((p, i) => toSummary(p, names, i)),
    materials: stones.map((stone, i) => ({
      id: i + 1,
      is_default: i === 0,
      sort_order: i,
      material: toMaterial(stone, i),
    })),
  };
}

export async function getMaterials(): Promise<Material[]> {
  const body = await get<{ groups: { group: string; items: WireMaterial[] }[] }>("/materials");
  return (body?.groups ?? []).flatMap((g) => g.items).map(toMaterial);
}

export async function getMaterial(slug: string): Promise<Material | null> {
  const body = await get<WireMaterial>(`/materials/${encodeURIComponent(slug)}`);
  return body ? toMaterial(body, 0) : null;
}

/**
 * Standing page copy.
 *
 * The API has no pages endpoint, so the copy ships with the site. A slug with
 * no record renders the "being prepared" line, as before.
 */
export async function getPage(slug: string): Promise<Page | null> {
  return (pages as Page[]).find((page) => page.slug === slug) ?? null;
}

const fetchSite = cache(() => get<WireSite>("/site"));

/** Photography for the homepage hero: the `hero` image slot. */
export async function getHeroImages(): Promise<ImageRef[]> {
  const site = await fetchSite();
  const hero = site?.slots?.hero;
  if (!hero) return [];
  return [hero.image, ...(hero.gallery ?? [])]
    .map(toImage)
    .filter((image): image is ImageRef => image !== null);
}

/**
 * The photograph in one of the site's standing image slots, `bespoke` on the
 * homepage or `founder` on the atelier page, or null while it is empty.
 */
export async function getSlotImage(key: "bespoke" | "founder"): Promise<ImageRef | null> {
  const site = await fetchSite();
  return toImage(site?.slots?.[key]?.image);
}
