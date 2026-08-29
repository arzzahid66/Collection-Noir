"use client";

import { useState } from "react";

/**
 * The enquiry form, figure 11.
 *
 * First name, last name, email, telephone (optional), location, and the
 * enquiry itself. Section 02 rules out cart and checkout language, because  copy-lint-ok
 * nothing is held in stock, so this is the only transactional surface at
 * launch and the submit reads "Send enquiry".
 *
 * Location has no column of its own on the enquiry record, so it is carried
 * into the message under a label rather than dropped. If the atelier starts
 * reporting on it, it earns a column.
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
    const location = value("location");
    const enquiry = value("message");

    const payload = {
      type: productId ? "product" : "general",
      name: [value("first_name"), value("last_name")].filter(Boolean).join(" "),
      email: value("email"),
      phone: value("phone") || null,
      company: null,
      message: location ? `Location: ${location}\n\n${enquiry}` : enquiry,
      product_id: productId ?? null,
    };

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
