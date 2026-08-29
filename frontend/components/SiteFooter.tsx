import Link from "next/link";

import { LEGAL_TABS } from "@/lib/nav";
import { STUDIO } from "@/lib/studio";

/**
 * Footer, section 3.
 *
 * Ground is Umber, the darkest ground on the site. Body copy on it is
 * #E8E4DC.
 *
 * Two columns above: the studio name and address left, the four legal links
 * right. A base row below: the mailing list and Instagram left, the admin
 * entrance and the tagline right.
 *
 * There is no lockup here. Section 3 sets the left column as an eyebrow and
 * an address, and the wordmark already sits at the top of every page; a
 * second one at the foot of it repeats the brand rather than closing the
 * page.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__columns">
        <address className="site-footer__address">
          <p className="eyebrow site-footer__eyebrow">Collection Noir</p>
          {STUDIO.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>

        <nav className="site-footer__legal" aria-label="Legal">
          {LEGAL_TABS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="site-footer__base">
        <div className="site-footer__base-left">
          <Link href="/enquire#mailing-list">Join our mailing list</Link>
          <a
            href={STUDIO.instagram}
            rel="noreferrer noopener"
            target="_blank"
            className="site-footer__instagram"
          >
            {/* The ring is part of the label rather than an icon beside it,
                section 3, so it is a glyph in the same face at the same size
                rather than an SVG. Written as an escape so no bare
                non-ASCII character enters the source. */}
            <span aria-hidden="true">{"\u25CE"}</span>
            Instagram
          </a>
        </div>
        {/* The approved design sets the administration entrance and the
            tagline together at the base right. */}
        <div className="site-footer__base-right">
          <Link href="/admin" className="site-footer__admin">
            Admin
          </Link>
          <p className="site-footer__tagline">{STUDIO.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
