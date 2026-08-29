import type { Metadata } from "next";
import Link from "next/link";

import { Prose } from "@/components/Prose";
import { getPage } from "@/lib/api";

export const metadata: Metadata = { title: "The Atelier" };

// Copy is editable in the admin console, so this page is never baked in at
// build time. An edit is visible on the next request.
export const dynamic = "force-dynamic";

/**
 * The Atelier, figure 9.
 *
 * Brand story, the founder, the trade proposition, press, and the two onward
 * links. Every block reads its copy from a page record rather than holding it
 * in markup, so the brand team edits it in the console. Section 04.
 */
export default async function AtelierPage() {
  const [page, founder, designers, press] = await Promise.all([
    getPage("atelier"),
    getPage("atelier-founder"),
    getPage("atelier-designers"),
    getPage("atelier-press"),
  ]);

  const publications = (press?.body ?? "")
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  return (
    <>
      <section className="atelier-intro">
        <p className="eyebrow">The Atelier</p>
        <h1>
          Designed in London,
          <br />
          made by <em>Italian hands</em>
        </h1>

        {/* Body copy runs the full width of its container, left aligned.
            Section 13 rules out the narrow column the earlier build
            applied, which stranded three quarters of the page. */}
        {page && <Prose body={page.body} />}
      </section>

      {founder && (
        <section className="founder-block">
          <p className="eyebrow">The Founder</p>
          <div className="founder">
            {/* TODO(client): the founder portrait is a placeholder block in the
                approved mockup and no photograph has been supplied. */}
            <div className="founder__portrait" role="presentation" />
            <div>
              <p className="founder__name">{founder.title}</p>
              <p className="founder__role">
                Founder and Designer, Collection Noir Atelier, London
              </p>
              {/* The approved mockup marks this quote as pending and asks for
                  real words or sign off before publishing. It is rendered from
                  the page record so the brand team can replace it without a
                  deploy, and it carries the placeholder marker until they do. */}
              <blockquote>
                <Prose body={founder.body} measure="measure-quote" />
              </blockquote>
            </div>
          </div>
        </section>
      )}

      {/* The heading, the paragraph and the call to action are centred as one
          group. The eyebrow above them is not: it stays left, which is how
          the locked design sets it, and the stylesheet states that per block
          rather than letting any of the three inherit. */}
      {designers && (
        <section className="designers">
          <div className="centred">
            <p className="eyebrow">For Designers</p>
            <h2>
              A working relationship,
              <br />
              <em>not a transaction</em>
            </h2>
            <Prose body={designers.body} measure="measure-designers" />
            <Link href="/trade" className="tracked-link">
              Register for Trade Access
            </Link>
          </div>
        </section>
      )}

      {/* The label is centred above the row, and the row is centred under it.
          Section 8. */}
      {publications.length > 0 && (
        <section className="press">
          <div className="centred-row">
            <p className="eyebrow">As Seen In</p>
            <ul className="press-row">
              {publications.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="exploring">
        <p className="eyebrow">Continue Exploring</p>
        <div className="two-column two-column--centred measure-exploring">
          <div>
            <h3>The Materials</h3>
            <p className="lede">
              A guide to the marbles, timbers and metals the atelier works with.
            </p>
            <Link href="/atelier/materials" className="tracked-link">
              View Materials
            </Link>
          </div>
          <div>
            <h3>Caring for your piece</h3>
            <p className="lede">
              Guidance by material, for marble, timber and metal.
            </p>
            <Link href="/care" className="tracked-link">
              View Care Guide
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
