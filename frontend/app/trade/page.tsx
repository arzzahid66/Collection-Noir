import type { Metadata } from "next";

import { TradeForm } from "@/components/TradeForm";

export const metadata: Metadata = { title: "Trade" };

/**
 * Trade page, section 10.
 *
 * The whole page sits on Ivory: there is no tinted band behind the
 * registration form, and a structural rule separates the intro from it.
 *
 * Every word on this page is set by the specification rather than held in
 * the console, so unlike the atelier and the enquiry pages there is nothing
 * to fetch and nothing to render dynamically.
 */
export default function TradePage() {
  return (
    <>
      <section className="trade-intro">
        <p className="eyebrow">Trade</p>
        <h1>
          A studio built
          <br />
          for <em>working with designers</em>
        </h1>
        {/* Full width, no cap. Section 13.

            The wording is the client's, given verbatim on the annotated trade
            page screenshot in the revision review. It replaces the
            specification's own paragraph, which named only designers and
            architects and closed on "built around how a design studio
            actually works". Developers are named now, and the sentence is one
            clause rather than two. */}
        <p className="trade-intro__body">
          We work with interior designers, developers and architects on a
          project-by-project basis, offering trade pricing, a dedicated point
          of contact, and direct access to the atelier throughout.
        </p>

        <ul className="numbered">
          <li>
            <span>01</span>Trade Pricing
          </li>
          <li>
            <span>02</span>Complimentary Bespoke Design
          </li>
          <li>
            <span>03</span>Specification Support
          </li>
        </ul>
      </section>

      {/* Set as a call to action rather than as a serif heading or an
          eyebrow: 16px at 0.26em, the same treatment the product page gives
          Enquire. Section 10. */}
      <section className="register-panel">
        {/*
         * Named by section 10 rather than read from the page record. The
         * `trade` record's title is "Trade", which is the name of the page,
         * and using it here set the invitation above the form to the same
         * word as the eyebrow at the top of it.
         */}
        <p className="register-panel__title">Register for Trade Access</p>
        <p className="register-panel__intro">
          Tell us a little about your studio. We review every application
          personally and aim to respond within two working days.
        </p>
        <TradeForm />
      </section>
    </>
  );
}
