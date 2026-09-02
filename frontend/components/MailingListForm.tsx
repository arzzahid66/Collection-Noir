"use client";

import { useState } from "react";

/**
 * The mailing list invitation, given verbatim in the client's review.
 *
 * One word in it sits on the prohibited lexicon in section 02, and the copy
 * lint is right to stop on it. This is the client's own signed off wording,
 * which section 11 makes authoritative over the lexicon, so the line is
 * marked rather than reworded. The marker is on this line and this line
 * only, so the word stays banned everywhere else on the site.
 */
const MAILING_LIST_INVITATION =
  "Subscribe to our mailing list for exclusive access"; // copy-lint-ok

/**
 * The mailing list signup, section 10.
 *
 * Three lines and nothing else: the header, the invitation, and a single
 * rule carrying an Email placeholder on the left and Join on the right.
 * No box around the field, no ground behind it, and no rule over the top of
 * the block.
 *
 * The client's review asked for the section to be set in the site's own
 * type rather than in a register of its own, so every part of it is a
 * treatment that already exists. The header is the `eyebrow` that labels
 * Showroom, Contact and Trade; the invitation is the italic Cormorant this
 * site sets invitation copy in; the field is the standard `field__line`
 * with `button--text` on the end of its rule, which is the control the
 * earlier review settled on.
 *
 * The header is written in title case and set uppercase by the eyebrow's
 * own rule, as every other eyebrow on the site is, so the casing stays a
 * property of the treatment rather than of the copy.
 *
 * The whole section is exported as one component rather than as a bare
 * form, so a page drops the block in whole and the header, the invitation
 * and the field cannot drift apart between pages.
 */
export function MailingListSection() {
  return (
    <section
      className="mailing"
      id="mailing-list"
      aria-labelledby="mailing-list-title"
    >
      <h2 className="eyebrow mailing__title" id="mailing-list-title">
        Mailing list
      </h2>
      <p className="mailing__lede">{MAILING_LIST_INVITATION}</p>
      <MailingListForm />
    </section>
  );
}

/**
 * The field itself.
 *
 * A signup is written to the enquiries record rather than to a list of its
 * own, so the atelier reads it in the same place it reads everything else
 * that arrives from the site. The enquiries record is given a fixed name, so
 * a signup reads as a signup in the console rather than as a nameless
 * enquiry, and the message names it as a mailing list request, which is the
 * form section 10 already described in words.
 */
export function MailingListForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "general",
          name: "Members list",
          email: value("email"),
          phone: null,
          company: null,
          message: "Members list: please add me to the members list.",
          product_id: null,
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 422
            ? "Please check the email address and try again."
            : "That did not send. Please try again, or write to the atelier directly.",
        );
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError(
        "That did not send. Please try again, or write to the atelier directly.",
      );
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="mailing__message" role="status">
        Thank you. You are on the list.
      </p>
    );
  }

  return (
    <form className="form mailing__form" onSubmit={onSubmit}>
      {/* The site's own field row: it carries the rule and the input inside
          it draws none, so Email and Join sit on one baseline over a single
          unbroken line.

          Email is the placeholder rather than a label stacked above the
          field, which is what puts the two on that shared line. A visually
          hidden label is kept so the input is still named for a screen
          reader, since a placeholder is not an accessible name. */}
      <div className="field">
        <div className="field__line">
          <label className="visually-hidden" htmlFor="mailing-email">
            Email
          </label>
          <input
            id="mailing-email"
            name="email"
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
          />
          <button
            className="button--text"
            type="submit"
            disabled={state === "sending"}
          >
            {state === "sending" ? "Joining" : "Join"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mailing__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
