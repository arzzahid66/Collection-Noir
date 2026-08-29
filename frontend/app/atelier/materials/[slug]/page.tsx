import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getMaterial } from "@/lib/api";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const material = await getMaterial(slug);
  return { title: material?.name ?? "Materials" };
}

// The materials library is edited in the admin console.
export const dynamic = "force-dynamic";

/**
 * A single material.
 *
 * The specification does not draw this page, so it borrows the treatments it
 * already sets elsewhere: the breadcrumb of section 6.1, the sample frame of
 * section 9, and the specification pairs of section 7.4.8. Nothing here
 * invents a value.
 */
export default async function MaterialPage({ params }: Props) {
  const { slug } = await params;
  const material = await getMaterial(slug);
  if (!material) notFound();

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/atelier", label: "Atelier" },
          { href: "/atelier/materials", label: "Materials" },
          { label: material.name },
        ]}
      />

      <section className="page section">
        <p className="eyebrow">The Materials</p>
        <h1 className="page-title">{material.name}</h1>

        <div className="two-column" style={{ marginTop: 32 }}>
          <div>
            <div
              className="material-card__image"
              data-photo={Boolean(material.image)}
              style={
                material.image
                  ? { backgroundImage: `url(${material.image.url})` }
                  : material.swatch_hex
                    ? { backgroundColor: material.swatch_hex }
                    : undefined
              }
              role="img"
              aria-label={material.image?.alt_text ?? material.name}
            />
          </div>
          <div>
            {material.description && <p>{material.description}</p>}

            {/* The same specification pairs the product page uses, so the
                two read as one system. Section 7.4.8. */}
            <dl className="spec-grid">
              {material.quarry && (
                <div>
                  <dt>Quarry</dt>
                  <dd>{material.quarry}</dd>
                </div>
              )}
              {material.region && (
                <div>
                  <dt>Region</dt>
                  <dd>{material.region}</dd>
                </div>
              )}
              <div>
                <dt>Origin</dt>
                <dd>{material.origin}</dd>
              </div>
              {material.finish && (
                <div>
                  <dt>Finish</dt>
                  <dd>{material.finish}</dd>
                </div>
              )}
            </dl>

            <p style={{ margin: "28px 0 0" }}>
              <Link href="/enquire" className="quiet-link">
                Enquire about this material
              </Link>
            </p>
            <p className="product__note">
              Samples are cut from stock, so what arrives is the material itself.
              A sample indicates character and will not predict the exact
              appearance of a finished piece.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
