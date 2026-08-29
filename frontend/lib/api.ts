import type {
  Category,
  ImageRef,
  Material,
  Page,
  ProductDetail,
  ProductSummary,
} from "./types";

/**
 * Server side requests go straight to FastAPI. Browser requests go through the
 * Next.js rewrite at /api, which keeps every request same origin.
 */
const SERVER_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

function url(path: string): string {
  return typeof window === "undefined" ? `${SERVER_BASE}${path}` : path;
}

/**
 * Fetch that tolerates the API being unreachable.
 *
 * A page must still render when the backend is down or the database has not
 * been seeded, otherwise a missing connection string turns every route into a
 * crash rather than an empty catalogue.
 */
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url(path), {
      // Product data, prices and copy are all editable from the admin console,
      // so nothing here is cached across requests.
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

async function getOrNull<T>(path: string): Promise<T | null> {
  return get<T | null>(path, null);
}

export function getCategories(): Promise<Category[]> {
  return get<Category[]>("/api/categories", []);
}

export function getCategory(slug: string): Promise<Category | null> {
  return getOrNull<Category>(`/api/categories/${slug}`);
}

export function getProducts(categorySlug?: string): Promise<ProductSummary[]> {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  return get<ProductSummary[]>(`/api/products${query}`, []);
}

export function getProduct(
  categorySlug: string,
  productSlug: string,
): Promise<ProductDetail | null> {
  return getOrNull<ProductDetail>(`/api/products/${categorySlug}/${productSlug}`);
}

export function getMaterials(): Promise<Material[]> {
  return get<Material[]>("/api/materials", []);
}

export function getMaterial(slug: string): Promise<Material | null> {
  return getOrNull<Material>(`/api/materials/${slug}`);
}

export function getPage(slug: string): Promise<Page | null> {
  return getOrNull<Page>(`/api/pages/${slug}`);
}

/**
 * Photography for the homepage hero.
 *
 * Any image attached to a live piece with the role `hero` is offered here, in
 * the order the console sets. With none attached the hero renders on its
 * ground colour rather than failing, which is what a first deploy looks like
 * before photography is supplied.
 */
export function getHeroImages(): Promise<ImageRef[]> {
  return get<ImageRef[]>("/api/hero-images", []);
}
