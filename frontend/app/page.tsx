import Link from "next/link";

import { CategoryCard } from "@/components/CategoryCard";
import { Hero } from "@/components/Hero";
import { Prose } from "@/components/Prose";
import { getCategories, getHeroImages, getPage, getProducts } from "@/lib/api";

// Every block on this page reads from the database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products, heroImages, intro, bespoke] = await Promise.all([
    getCategories(),
    getProducts(),
    getHeroImages(),
    getPage("home-intro"),
    getPage("home-bespoke"),
  ]);

  // The teaser links into the top categories, per section 06. Three cards,
  // taken in the order the categories are sorted in the console.
  //
  // Each card names the first publishable piece in its category beneath the
  // category name, which is how the approved design sets it. A category with
  // nothing published yet shows the frame and the name alone rather than an
  // empty line.
  const teaser = categories
    .filter((c) => c.status === "live")
    .slice(0, 3)
    .map((category) => ({
      category,
      piece: products.find((p) => p.category_slug === category.slug) ?? null,
    }));

  return (
    <>
      <Hero
        eyebrow="London Design. Italian Craft."
        headline="Material"
        headlineItalic="in its"
        headlineTail="purest form"
        note="Each piece is made once, made properly, and made to last."
        frames={heroImages}
      />

      {/* The statement. The one centred, width capped block on the page;
          everything below it is left aligned and runs full width.
          Section 4.2. */}
      {intro && (
        <section className="statement">
          <p className="measure-statement">{firstLine(intro.body)}</p>
        </section>
      )}

      <section className="teasers">
        <div className="page">
          <p className="eyebrow teasers__label">The Collection</p>
        </div>
        {teaser.length > 0 ? (
          <div className="category-grid category-grid--teasers">
            {teaser.map(({ category, piece }) => (
              <CategoryCard
                key={category.slug}
                category={category}
                teaser
                piece={piece}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">The collection is being prepared.</p>
        )}
      </section>

      {bespoke && (
        <section className="split">
          <div>
            <p className="eyebrow split__eyebrow">Bespoke</p>
            <h2>
              Every piece begins
              <br />
              with <em>a conversation</em>
            </h2>
            {/* Full column width. Section 13 rules out the narrow measure
                the earlier build capped this at. */}
            <div className="split__body">
              <Prose body={bespoke.body} />
            </div>
            <Link href="/enquire" className="quiet-link">
              Enquire
            </Link>
          </div>
          {/* TODO(client): the bespoke photograph is a placeholder block in the
              approved mockup and no image has been supplied for it. It renders
              on the mount colour until one is attached. */}
          <div className="split__figure" role="presentation">
            <span className="image-placeholder">BESPOKE</span>
          </div>
        </section>
      )}
    </>
  );
}

/** The intro line is one sentence. Anything after it belongs on the atelier
 * page rather than under the hero. */
function firstLine(body: string): string {
  return body.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
}
