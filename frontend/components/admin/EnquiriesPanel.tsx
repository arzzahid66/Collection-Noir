"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi, type Submission } from "@/lib/admin";
import { PanelProps, StatusLine, formatDate, usePanelStatus } from "./common";

type Filter = "all" | "enquiry" | "trade" | "unread";

/** The order the inbox export uses. Anything else follows, as it arrived. */
const FIELD_ORDER = [
  "First Name",
  "Last Name",
  "Studio Name",
  "Company",
  "Email",
  "Phone (optional)",
  "Phone",
  "Location",
  "Website",
  "Company Reg. Number",
  "VAT Number",
  "Registered Address",
  "Message",
];

function ordered(fields: Record<string, string>): [string, string][] {
  const rank = (label: string) => {
    const index = FIELD_ORDER.indexOf(label);
    return index === -1 ? FIELD_ORDER.length : index;
  };
  return Object.entries(fields).sort(([a], [b]) => rank(a) - rank(b));
}

/**
 * Enquiries and trade applications from the site.
 *
 * Submissions caught by the spam checks are kept rather than dropped, so a
 * false positive can still be found; they sit behind their own toggle.
 */
export function EnquiriesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [items, setItems] = useState<Submission[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [spam, setSpam] = useState(false);

  const load = useCallback(async () => {
    try {
      const body = await adminApi.submissions(spam);
      setItems(body.submissions);
      setUnread(body.unread);
    } catch (error) {
      report(error);
    }
  }, [report, spam]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRead(item: Submission) {
    try {
      const updated = await adminApi.markRead(item.id, !item.read);
      setItems((current) => current.map((s) => (s.id === item.id ? updated : s)));
      setUnread((n) => n + (updated.read ? -1 : 1));
    } catch (error) {
      report(error);
    }
  }

  async function remove(item: Submission) {
    if (!window.confirm("Delete this submission permanently?")) return;
    try {
      await adminApi.deleteSubmission(item.id);
      setItems((current) => current.filter((s) => s.id !== item.id));
      say("Deleted.");
    } catch (error) {
      report(error);
    }
  }

  async function exportCsv() {
    try {
      const blob = await adminApi.exportCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `collection-noir-inbox-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      report(error);
    }
  }

  const shown = items.filter((item) =>
    filter === "all" ? true : filter === "unread" ? !item.read : item.kind === filter,
  );

  return (
    <>
      <p className="admin-note">
        Everything sent from the enquiry, trade and mailing list forms. Each one is also
        emailed to the atelier. {unread > 0 && <strong>{unread} unread.</strong>}
      </p>

      <div className="admin-actions" style={{ marginBottom: 20 }}>
        {(["all", "unread", "enquiry", "trade"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className="admin__tab"
            data-active={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "unread" ? "Unread" : f === "enquiry" ? "Enquiries" : "Trade"}
          </button>
        ))}
        <label className="admin__tab">
          <input type="checkbox" checked={spam} onChange={(e) => setSpam(e.target.checked)} /> Spam
        </label>
        <button type="button" className="admin-button admin-button--quiet" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <StatusLine status={status} tone={tone} />

      {shown.length === 0 ? (
        <p className="admin-status">Nothing here.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Type</th>
              <th>Details</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.id} style={{ fontWeight: item.read ? 400 : 600 }}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDate(item.at)}</td>
                <td>
                  {item.kind === "trade" ? "Trade" : "Enquiry"}
                  {item.regarding && (
                    <>
                      <br />
                      <span className="image-tile__meta">Re: {item.regarding}</span>
                    </>
                  )}
                  {item.discarded && (
                    <>
                      <br />
                      <span className="pill">Spam · {item.discardReason}</span>
                    </>
                  )}
                </td>
                <td>
                  <dl className="admin-fields">
                    {ordered(item.fields).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                          {label === "Email" ? <a href={`mailto:${value}`}>{value}</a> : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    className="admin-button--link"
                    onClick={() => toggleRead(item)}
                  >
                    Mark {item.read ? "unread" : "read"}
                  </button>
                  <br />
                  <button type="button" className="admin-button--link" onClick={() => remove(item)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
