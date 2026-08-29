import type { MetadataRoute } from "next";

import { getCategories, getProducts } from "@/lib/api";

/**
 * The sitemap robots.ts has always pointed at.
 *
 * `robots.ts` advertises https://collectionnoir.com/sitemap.xml, and until now
 * that URL returned a 404: the route did not exist. Every crawler that
 * followed the reference found nothing.
 *
 * Only publicly visible pieces are listed. That is not a filter applied here:
 * `/api/products` returns pieces that pass the single visibility gate on the
 * product record, live and priced, so a piece withheld from the grids is
 * absent from the sitemap for the same reason and at the same moment. There
 * is no second rule here that could drift from the first.
 */
export const dynamic = "force-dynamic";

const ORIGIN = "https://collectionnoir.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  const now = new Date();

  const standing = [
    "/",
    "/collection",
    "/atelier",
    "/atelier/materials",
    "/trade",
    "/enquire",
    "/care",
    "/showroom",
    "/press",
    "/faqs",
    "/sustainability",
    "/accessibility",
    "/legal/terms",
    "/legal/shipping",
    "/legal/returns",
    "/legal/privacy",
  ];

  return [
    ...standing.map((path) => ({
      url: `${ORIGIN}${path}`,
      lastModified: now,
    })),
    // A hidden collection is not linked from anywhere on the site, so it is
    // not offered to a crawler either.
    ...categories
      .filter((category) => category.status !== "hidden")
      .map((category) => ({
        url: `${ORIGIN}/collection/${category.slug}`,
        lastModified: now,
      })),
    ...products.map((product) => ({
      url: `${ORIGIN}/collection/${product.category_slug}/${product.slug}`,
      lastModified: now,
    })),
  ];
}
