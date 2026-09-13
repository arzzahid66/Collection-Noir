"use client";

import { useState } from "react";

import { submitForm } from "@/lib/forms";

/**
 * Trade registration, figure 10.
 *
 * Eight fields across two rows: first name, last name, studio name, email,
 * website, company registration number, VAT number, registered address.
 *
 * Sent as a trade application, every field under the label the atelier's
 * inbox and export use, so an application arrives complete.
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

    const result = await submitForm("trade", {
      "First Name": value("first_name"),
      "Last Name": value("last_name"),
      "Studio Name": value("studio_name"),
      Email: value("email"),
      ...Object.fromEntries(DETAIL_FIELDS.map(({ name, label }) => [label, value(name)])),
    });
    if (result.ok) {
      setState("sent");
    } else {
      setError(result.message);
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
