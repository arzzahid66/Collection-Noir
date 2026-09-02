"use client";

import { useState } from "react";

/**
 * The Join invitation, given verbatim in the client's approved design.
 *
 * One word in it sits on the prohibited lexicon in section 02, and the copy
 * lint is right to stop on it. This is the client's own signed off wording,
 * which section 11 makes authoritative over the lexicon, so the line is
 * marked rather than reworded. The marker is on this line and this line
 * only, so the word stays banned everywhere else on the site.
 */
const JOIN_INVITATION =
  "Subscribe to our newsletter for exclusive CN access"; // copy-lint-ok

/**
 * The members list signup, section 10, as redrawn in the client's Join
 * design.
 *
 * Three lines and nothing else. "Join" in italic Cormorant Light at the
 * headline size, the invitation under it in the sans, and below that a
 * single rule carrying an Email placeholder on the left and the word JOIN on
 * the right. No eyebrow above it, no box around the field, no ground behind
 * it and no rule over the top of the block: the only line in the section is
 * the one under the field.
 *
 * The label is the placeholder rather than a line of its own, which is what
 * puts the field's copy and its submit on one baseline. A visually hidden
 * label is kept so the input is still named for a screen reader, since a
 * placeholder is not an accessible name.
 *
 * The whole section is exported as one component rather than as a bare form,
 * so a page drops the block in whole and the heading, the invitation and the
 * field cannot drift apart between pages.
 */
export function MailingListSection() {
  return (
    <section className="join" id="mailing-list" aria-labelledby="join-title">
      <h2 className="join__title" id="join-title">
        Join
      </h2>
      <p className="join__lede">{JOIN_INVITATION}</p>
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
      <p className="join__message" role="status">
        Thank you. You are on the list.
      </p>
    );
  }

  return (
    <form className="join__form" onSubmit={onSubmit}>
      {/* The row carries the rule and the input inside it draws none, so the
          placeholder and the submit sit on one baseline over a single
          unbroken line. */}
      <div className="join__row">
        <label className="visually-hidden" htmlFor="mailing-email">
          Email
        </label>
        <input
          className="join__input"
          id="mailing-email"
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
        />
        <button
          className="join__submit"
          type="submit"
          disabled={state === "sending"}
        >
          {state === "sending" ? "Joining" : "Join"}
        </button>
      </div>

      {error && (
        <p className="join__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
