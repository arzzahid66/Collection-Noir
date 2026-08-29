import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getCategory, getProducts } from "@/lib/api";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  return { title: category?.name ?? "Collection" };
}

// The catalogue is edited in the admin console, so category pages are never
// baked in at build time. Prerendering the set of categories would go stale
// the moment one was added, renamed or hidden.
export const dynamic = "force-dynamic";

/**
 * Category page, figures 4 to 8.
 *
 * A breadcrumb, a short category description line, a horizontal tab row for
 * switching between all the categories without returning to the overview,
 * then the product grid itself. Section 06.
 *
 * The grid frames are shaped by the ratio held on each category row, which is
 * the whole point of section 07: a round dining table and a tall cylindrical
 * plinth are genuinely different shapes, so there is no site wide ratio here.
 */
export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const [category, categories] = await Promise.all([
    getCategory(slug),
    getCategories(),
  ]);

  if (!category || category.status === "hidden") notFound();

  const products = await getProducts(slug);
  const tabs = categories.filter((c) => c.status !== "hidden");

  // A short category leaves a trailing cell in the three column grid. The
  // approved mockups fill it with a bespoke prompt rather than white space.
  const showPrompt =
    Boolean(category.bespoke_prompt) && products.length > 0 && products.length < 3;

  return (
    <>
      {/* The current collection name is set italic, section 6.1. */}
      <Breadcrumbs
        crumbs={[
          { href: "/collection", label: "Collection" },
          { label: category.name, italic: true },
        ]}
      />

      <div className="category-head">
        <h1>{category.name}</h1>
        {category.intro_copy && <p>{category.intro_copy}</p>}
      </div>

      <nav className="category-tabs" aria-label="Categories">
        {tabs.map((tab) => (
          <Link
            key={tab.slug}
            href={`/collection/${tab.slug}`}
            aria-current={tab.slug === category.slug ? "page" : undefined}
          >
            {tab.name}
          </Link>
        ))}
      </nav>

      {products.length > 0 ? (
        <div className="category-grid category-grid--pieces">
          {products.map((product) => (
            <ProductCard
              key={`${product.category_slug}-${product.slug}`}
              product={product}
            />
          ))}

          {showPrompt && (
            <div className="grid-prompt">
              <p>{category.bespoke_prompt}</p>
              <Link href="/enquire" className="tracked-link">
                Begin a bespoke enquiry
              </Link>
            </div>
          )}
        </div>
      ) : (
        // A category with nothing publishable still renders. Bedside tables
        // sits here at launch, because Kaia has neither a confirmed price nor
        // photography yet and is withheld until both are entered.
        <div className="empty-state">
          <p style={{ marginBottom: 16 }}>
            {category.bespoke_prompt ?? "Pieces in this category are in preparation."}
          </p>
          <Link href="/enquire" className="tracked-link">
            Begin a bespoke enquiry
          </Link>
        </div>
      )}
    </>
  );
}
