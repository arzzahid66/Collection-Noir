import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Prose } from "@/components/Prose";
import { getMaterials, getPage } from "@/lib/api";
import type { Material } from "@/lib/types";

export const metadata: Metadata = { title: "Materials" };

export const dynamic = "force-dynamic";

const FAMILY_LABEL: Record<string, string> = {
  marble: "Stone",
  timber: "Timber",
  metal: "Metal",
};

/** The word the attribute line leads with, which is the material itself
 * rather than the group it is filed under. */
const FAMILY_NOUN: Record<string, string> = {
  marble: "Marble",
  timber: "Timber",
  metal: "Metal",
};

/**
 * The attribute line beneath a material name: the material, then where it
 * comes from, separated by a middot. "Marble · Italy", section 9.
 *
 * TODO(client): the design distinguishes limestone from marble and veneer
 * from solid hardwood on this line. The library holds one family per material
 * rather than a name for the material itself, so the family word is used
 * until that detail is supplied. Logged in PENDING_CHANGES.md.
 */
function attributes(material: Material): string {
  const noun = FAMILY_NOUN[material.family] ?? FAMILY_LABEL[material.family];
  const place = material.origin || material.region;
  return place ? `${noun} · ${place}` : noun;
}

/**
 * The materials library, section 9.
 *
 * A sub page of the atelier, at /atelier/materials, reached from the Atelier
 * menu in the header and from "View Materials" at the foot of the atelier
 * page. Grouped Stone, then Timber, then Metal, in that order. An empty
 * group is omitted entirely rather than rendered as a labelled blank.
 */
export default async function MaterialsPage() {
  const [materials, page] = await Promise.all([
    getMaterials(),
    getPage("materials-intro"),
  ]);

  const families = ["marble", "timber", "metal"] as const;

  return (
    <>
      {/* Rendered bare, as the category and product pages render it. The bar
          carries its own 22px and 48px padding, so wrapping it in `page` as
          well indented it to 96px, twice every other breadcrumb on the
          site. */}
      <Breadcrumbs
        crumbs={[{ href: "/atelier", label: "Atelier" }, { label: "Materials" }]}
      />

      <section className="materials-head">
        <p className="eyebrow">The Materials</p>
        <h1 className="page-title">The stones, timbers and metals we work with</h1>
        {/* Full width, no cap. Section 13. */}
        {page && <Prose body={page.body} />}
      </section>

      <div className="material-groups">
        {families.map((family) => {
          const inFamily = materials.filter((m) => m.family === family);
          if (inFamily.length === 0) return null;
          return (
            <section key={family} className="material-group">
              <p className="eyebrow material-group__label">{FAMILY_LABEL[family]}</p>
              <div className="material-list">
                {inFamily.map((material) => (
                  <Link key={material.slug} href={`/atelier/materials/${material.slug}`}>
                    {/*
                     * A material surface fills its frame; a piece of
                     * furniture never does. data-photo carries that
                     * distinction to the stylesheet, so the swatch fallback
                     * below stays a flat colour rather than being stretched.
                     * Section 9.
                     */}
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
                    <p className="material-card__name">{material.name}</p>
                    <p className="material-card__meta">{attributes(material)}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {materials.length === 0 && (
        <p className="empty-state">The library is being prepared.</p>
      )}
    </>
  );
}
