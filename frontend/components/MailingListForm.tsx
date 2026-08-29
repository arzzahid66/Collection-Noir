"use client";

import { useState } from "react";

/**
 * The members list signup, section 10.
 *
 * One field, an email address, which is everything the list needs. The
 * client's review asked for a single box on the contact page, so the name is
 * not collected here; the enquiries record is given a fixed name instead, so
 * a signup reads as a signup in the console rather than as a nameless
 * enquiry.
 *
 * A signup is written to the enquiries record rather than to a list of its
 * own, so the atelier reads it in the same place it reads everything else
 * that arrives from the site. The message names it as a mailing list request,
 * which is the form section 10 already described in words.
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
      <p className="form__message" role="status">
        Thank you. You are on the list.
      </p>
    );
  }

  return (
    <form className="form form--mailing" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="mailing-email">Email</label>
        <input
          id="mailing-email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <div className="form__foot" style={{ justifyContent: "flex-start" }}>
        <button
          className="button button--enquiry"
          type="submit"
          disabled={state === "sending"}
        >
          {state === "sending" ? "Joining" : "Join the list"}
        </button>
      </div>
    </form>
  );
}
