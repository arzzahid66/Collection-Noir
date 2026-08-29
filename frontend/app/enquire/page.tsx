import type { Metadata } from "next";
import Link from "next/link";

import { EnquiryForm } from "@/components/EnquiryForm";
import { MailingListForm } from "@/components/MailingListForm";
import { getProduct, getProducts } from "@/lib/api";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = { title: "Enquire" };

/**
 * The members list invitation, given verbatim in the revision review.
 *
 * One word in it sits on the prohibited lexicon in section 02, and the copy
 * lint is right to stop on it. This is the client's own signed off wording,
 * which section 11 makes authoritative over the lexicon, so the line is
 * marked rather than reworded. The marker is on this line and this line only,
 * so the word stays banned everywhere else on the site.
 */
const MEMBERS_LIST_INVITATION = "Join our members list for exclusive access"; // copy-lint-ok

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ piece?: string; regarding?: string }>;
}

/**
 * Enquiry page, section 11.
 *
 * Two columns divided by a single vertical rule. The invitation, the piece
 * being enquired about and the studio details sit left; the form sits right.
 */
export default async function EnquirePage({ searchParams }: Props) {
  const { piece, regarding } = await searchParams;

  /*
   * A product page links here as /enquire?piece=collection/slug, so the
   * enquiry arrives already attached to the piece. The collection is part of
   * the parameter because a bare slug can match more than one record: the
   * Otis and Oria families each name a piece in two collections.
   *
   * Section 12's example is a bare `?regarding=roma`, so that form is
   * accepted too and resolved by searching the catalogue for the slug. A
   * link written to the specification works; the links this site generates
   * cannot be ambiguous.
   */
  let product = null;
  if (piece) {
    const [categorySlug, productSlug] = piece.split("/");
    if (categorySlug && productSlug) {
      product = await getProduct(categorySlug, productSlug);
    }
  } else if (regarding) {
    const match = (await getProducts()).find((p) => p.slug === regarding);
    if (match) {
      product = await getProduct(match.category_slug, match.slug);
    }
  }

  return (
    <div className="enquire">
      <div className="enquire__left">
        <p className="eyebrow">Enquire</p>
        {/* Named by section 11.1. The `enquire-intro` record's title is
            "Enquire", which is the name of the page and is already the
            eyebrow above this line. */}
        <h1 className="page-title">Begin a conversation</h1>
        {/* Balanced so it sets as two roughly equal lines rather than four
            ragged ones. Section 11.1. */}
        <p className="enquire__lede measure-invitation">
          Every piece is made to order. Tell us a little about what you are
          considering, and we will be in touch to discuss materials, dimensions
          and timing.
        </p>

        {/* Arrives from a product page's Enquire call to action, so the
            enquiry is already attached to the piece. Section 11.1. */}
        {product && (
          <div className="panel panel--regarding measure-regarding">
            <p className="panel__label">Regarding</p>
            <p>
              {product.name}
              {product.subtitle ? `, ${product.subtitle.toLowerCase()}` : ""}
            </p>
            <Link href="/enquire" className="panel__undo">
              Remove and enquire generally
            </Link>
          </div>
        )}

        {/* The address, the telephone number and the email are copy, not
            labels: italic Cormorant in Ink with no tracking. Only the label
            above each block is tracked. Section 11.1. */}
        <div className="enquire__block enquire__block--showroom">
          <p className="eyebrow">Showroom</p>
          {/* The showroom lines, which name London. The footer's are shorter.
              Section 11.1. */}
          {STUDIO.showroomLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="eyebrow" style={{ margin: "14px 0 0" }}>
            {STUDIO.showroomNote}
          </p>
        </div>

        <div className="enquire__block enquire__block--contact">
          <p className="eyebrow">Contact</p>
          <p>
            <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
          </p>
          <p>
            <a href={STUDIO.telephoneHref}>{STUDIO.telephone}</a>
          </p>
        </div>

        {/* Section 10 requires a mailing list signup in the footer of every
            page. The footer link lands here, on a form of its own: one box for
            an email address, rather than an instruction to write the words
            into an enquiry. The invitation is the client's wording from the
            revision review, verbatim. */}
        <div className="enquire__block" id="mailing-list">
          <p className="eyebrow">Mailing list</p>
          <p>{MEMBERS_LIST_INVITATION}</p>
          <MailingListForm />
        </div>
      </div>

      <div className="enquire__right">
        <EnquiryForm
          productId={product?.id}
          productLabel={product ? product.name : undefined}
        />
      </div>
    </div>
  );
}
