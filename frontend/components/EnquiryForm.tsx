"use client";

import { useState } from "react";

import { submitForm } from "@/lib/forms";

/**
 * The enquiry form, figure 11.
 *
 * First name, last name, email, telephone (optional), location, and the
 * enquiry itself. Section 02 rules out cart and checkout language, because  copy-lint-ok
 * nothing is held in stock, so this is the only transactional surface at
 * launch and the submit reads "Send enquiry".
 *
 * Each field is sent under the label the atelier's inbox and export use, and
 * an enquiry from a product page names the piece as "regarding".
 */
export function EnquiryForm({
  productId,
  productLabel,
}: {
  productId?: number;
  productLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();

    const result = await submitForm(
      "enquiry",
      {
        "First Name": value("first_name"),
        "Last Name": value("last_name"),
        Email: value("email"),
        "Phone (optional)": value("phone"),
        Location: value("location"),
        Message: value("message"),
      },
      productLabel ?? "",
    );
    if (result.ok) {
      setState("sent");
    } else {
      setError(result.message);
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="form__message form__message--panel" role="status">
        Thank you. We reply within two working days.
      </p>
    );
  }

  return (
    <form className="form form--grid-2" onSubmit={onSubmit}>
      {productLabel && (
        <input type="hidden" name="piece" value={productLabel} readOnly />
      )}

      <div className="field">
        <label htmlFor="enquiry-first">First Name</label>
        <input
          id="enquiry-first"
          name="first_name"
          type="text"
          required
          autoComplete="given-name"
        />
      </div>

      <div className="field">
        <label htmlFor="enquiry-last">Last Name</label>
        <input
          id="enquiry-last"
          name="last_name"
          type="text"
          autoComplete="family-name"
        />
      </div>

      <div className="field">
        <label htmlFor="enquiry-email">Email</label>
        <input
          id="enquiry-email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label htmlFor="enquiry-phone">Phone (Optional)</label>
        <input id="enquiry-phone" name="phone" type="tel" autoComplete="tel" />
      </div>

      <div className="field field--wide">
        <label htmlFor="enquiry-location">Location</label>
        <input
          id="enquiry-location"
          name="location"
          type="text"
          placeholder="City, country"
          autoComplete="country-name"
        />
      </div>

      <div className="field field--wide">
        <label htmlFor="enquiry-message">Tell us about your enquiry</label>
        {/* Three rows, section 11.2. */}
        <textarea
          id="enquiry-message"
          name="message"
          rows={3}
          required
          placeholder="Dimensions, finish, timing, whatever is useful to know"
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
          {state === "sending" ? "Sending" : "Send Enquiry"}
        </button>
      </div>

      <p className="form__note">
        We only use these details to respond to your enquiry. No marketing
        lists, no third parties.
      </p>
    </form>
  );
}
