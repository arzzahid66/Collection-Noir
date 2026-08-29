"use client";

import { useState } from "react";

/**
 * The "Add to Order" branch.
 *
 * Reserved for a future collection. No piece in the launch catalogue sets
 * `purchasable`, so this component does not render anywhere on the live site.
 * The Enquire branch on the product page is a plain link and does not use it.
 *
 * There is no cart, no basket and no checkout behind this. The endpoint  copy-lint-ok
 * records intent and currently answers 501, which is where that work resumes
 * when the collection is ready.
 */
export function AddToOrderButton({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(body.detail ?? "Ordering opens with the next collection.");
    } catch {
      setMessage("Ordering opens with the next collection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="product__cta"
        onClick={onClick}
        disabled={busy}
        aria-label={`Add ${productName} to order`}
      >
        Add to Order
      </button>
      {message && (
        <p className="product__note" role="status">
          {message}
        </p>
      )}
    </>
  );
}
