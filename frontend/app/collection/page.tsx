import type { Metadata } from "next";

import { CategoryCard } from "@/components/CategoryCard";
import { getCategories } from "@/lib/api";

export const metadata: Metadata = {
  title: "Collection",
};

export const dynamic = "force-dynamic";

/**
 * Collection overview, figure 2.
 *
 * A grid of category tiles, one per category, each linking through to its
 * category page, each showing a representative image and the category name.
 * Section 06.
 */
export default async function CollectionPage() {
  const categories = await getCategories();
  const shown = categories.filter((c) => c.status !== "hidden");

  return (
    <>
      {/* Section 5: 40px above, and the title is 26px rather than the 30px
          the other page titles take. */}
      <section className="collection-head">
        <p className="eyebrow">The Collection</p>
        <h1 className="collection-title">Every piece, made to order</h1>
      </section>

      {shown.length > 0 ? (
        <div className="category-grid category-grid--index">
          {shown.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      ) : (
        <p className="empty-state">The collection is being prepared.</p>
      )}
    </>
  );
}
