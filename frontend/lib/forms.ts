/**
 * Submits a public form to the API.
 *
 * The API stores a submission as labelled fields rather than columns. The
 * labels below are the ones the atelier's inbox, CSV export and notification
 * email are laid out by ("First Name", "Email", "Studio Name" and so on), so
 * a form must use them exactly or the value lands in an unnamed column.
 *
 * The client id is an idempotency key: a double click or a retried request
 * cannot put the same enquiry in the inbox twice.
 */
export type SubmissionKind = "enquiry" | "trade";

export type SubmitResult = { ok: true } | { ok: false; message: string };

const FALLBACK =
  "That did not send. Please try again, or write to the atelier directly.";

/*
 * Forms post straight to the API rather than through the /api rewrite. The API
 * limits submissions per visitor address, and a request forwarded by the
 * rewrite arrives from the host's servers instead, so every visitor would
 * share one allowance. The API allows this site's origin by CORS. Unset in
 * local development, where the rewrite is fine.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function submitForm(
  kind: SubmissionKind,
  fields: Record<string, string>,
  regarding = "",
): Promise<SubmitResult> {
  const path = `${API_BASE}/api/v1/${kind === "trade" ? "trade-applications" : "enquiries"}`;
  const cleaned = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value.trim() !== ""),
  );

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: clientId(), regarding, fields: cleaned }),
    });
    if (response.ok) return { ok: true };

    // 422 (a missing name, an unreadable email) and 429 (too many from one
    // address) carry a sentence written for the visitor. Anything else does not.
    if (response.status === 422 || response.status === 429) {
      const body = await response.json().catch(() => null);
      const message = body?.error?.message;
      if (typeof message === "string" && message) return { ok: false, message };
    }
    return { ok: false, message: FALLBACK };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}

function clientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
