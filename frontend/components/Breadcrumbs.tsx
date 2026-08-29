import Link from "next/link";

export interface Crumb {
  href?: string;
  label: string;
  /**
   * Sets the trailing crumb italic. Section 6.1 sets a collection name that
   * way and section 7.1 sets a piece name roman, so the two are distinguished
   * here rather than applied to every trailing crumb.
   */
  italic?: boolean;
}

/**
 * The breadcrumb set above a category page, a product page and the materials
 * library: "Collection / Dining Tables", "Collection / Dining Tables / Roma",
 * "Atelier / Materials". Section 6.1.
 *
 * The separator is a solidus and is drawn as a decorative span rather than
 * written into the label text, so it is never read out by a screen reader.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} style={{ display: "contents" }}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {crumb.href ? (
            <Link href={crumb.href}>{crumb.label}</Link>
          ) : (
            <span aria-current="page" data-italic={crumb.italic ? "true" : undefined}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
