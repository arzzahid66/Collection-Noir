"use client";

import { useState } from "react";

/**
 * Trade registration, figure 10.
 *
 * Eight fields across two rows: first name, last name, studio name, email,
 * website, company registration number, VAT number, registered address.
 *
 * The enquiry record carries a name, an email, a telephone, a company and a
 * message. The studio name maps onto company; the remaining trade specific
 * details are composed into the message under labels rather than dropped, so
 * an application arrives complete in the enquiry inbox. Dedicated columns are
 * logged as a candidate if trade volume makes reporting on them worthwhile.
 */
const DETAIL_FIELDS: { name: string; label: string; type?: string }[] = [
  { name: "website", label: "Website", type: "url" },
  { name: "company_number", label: "Company Reg. Number" },
  { name: "vat_number", label: "VAT Number" },
  { name: "registered_address", label: "Registered Address" },
];

export function TradeForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();

    const details = DETAIL_FIELDS.map(({ name, label }) => {
      const entry = value(name);
      return entry ? `${label}: ${entry}` : null;
    }).filter(Boolean);

    const payload = {
      type: "trade",
      name: [value("first_name"), value("last_name")].filter(Boolean).join(" "),
      email: value("email"),
      phone: null,
      company: value("studio_name") || null,
      message: details.length
        ? details.join("\n")
        : "Trade registration, no further details supplied.",
      product_id: null,
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

  return (
    <form className="form form--grid-4" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="trade-first">First Name</label>
        <input
          id="trade-first"
          name="first_name"
          type="text"
          required
          autoComplete="given-name"
        />
      </div>

      <div className="field">
        <label htmlFor="trade-last">Last Name</label>
        <input
          id="trade-last"
          name="last_name"
          type="text"
          autoComplete="family-name"
        />
      </div>

      <div className="field">
        <label htmlFor="trade-studio">Studio Name</label>
        <input
          id="trade-studio"
          name="studio_name"
          type="text"
          autoComplete="organization"
        />
      </div>

      <div className="field">
        <label htmlFor="trade-email">Email</label>
        <input
          id="trade-email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>

      {DETAIL_FIELDS.map((field) => (
        <div className="field" key={field.name}>
          <label htmlFor={`trade-${field.name}`}>{field.label}</label>
          <input
            id={`trade-${field.name}`}
            name={field.name}
            type={field.type ?? "text"}
          />
        </div>
      ))}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {/*
       * The submit row, section 10: the success message sits to the left of
       * the button rather than replacing the form. The form stays on the
       * page so a studio can see what it sent.
       */}
      <div className="form__foot">
        {state === "sent" && (
          <p className="form__message" role="status">
            Thank you. We review every application personally and aim to
            respond within two working days.
          </p>
        )}
        <button
          className="button"
          type="submit"
          disabled={state === "sending" || state === "sent"}
        >
          {state === "sending" ? "Sending" : "Register"}
        </button>
      </div>
    </form>
  );
}
