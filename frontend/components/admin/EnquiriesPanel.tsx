"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/admin";
import type { Enquiry } from "@/lib/types";
import { PanelProps, usePanelStatus } from "./common";

/**
 * Formats a timestamp identically on the server and in the browser.
 *
 * toLocaleDateString resolves against the host's locale and timezone, so the
 * server and the client can disagree and produce a hydration mismatch. The
 * parts are read explicitly instead.
 */
function received(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export function EnquiriesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report } = usePanelStatus(onUnauthorised);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);

  const load = useCallback(async () => {
    try {
      setEnquiries(await adminApi.enquiries());
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * `handled` has existed on the model, in EnquiryOut and on the PATCH route
   * since the console was built, but nothing surfaced it, so an inbox of
   * enquiries offered no way to record that one had been answered. With no
   * such mark, the only way to work the list is to remember it.
   *
   * The row is updated from the response rather than reloaded, so the table
   * does not reorder under the cursor mid-click.
   */
  const setHandled = useCallback(
    async (enquiry: Enquiry, handled: boolean) => {
      try {
        const updated = await adminApi.markEnquiryHandled(enquiry.id, handled);
        setEnquiries((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        );
      } catch (error) {
        report(error);
      }
    },
    [report],
  );

  return (
    <>
      <p className="admin-note">
        Enquiries submitted through the site. Product enquiries arrive already
        attached to the piece the client was reading.
      </p>

      {status && (
        <p className="admin-status" data-tone={tone} role="status">
          {status}
        </p>
      )}

      {enquiries.length === 0 ? (
        <p className="admin-status">No enquiries yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Type</th>
              <th>From</th>
              <th>Enquiry</th>
              <th>Handled</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => (
              <tr key={enquiry.id} data-handled={enquiry.handled ? "true" : "false"}>
                <td style={{ whiteSpace: "nowrap" }}>{received(enquiry.created_at)}</td>
                <td>{enquiry.type}</td>
                <td>
                  {enquiry.name}
                  <br />
                  <span className="image-tile__meta">{enquiry.email}</span>
                  {enquiry.phone && (
                    <>
                      <br />
                      <span className="image-tile__meta">{enquiry.phone}</span>
                    </>
                  )}
                  {enquiry.company && (
                    <>
                      <br />
                      <span className="image-tile__meta">{enquiry.company}</span>
                    </>
                  )}
                </td>
                <td style={{ whiteSpace: "pre-wrap" }}>{enquiry.message}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <label className="enquiry-handled">
                    <input
                      type="checkbox"
                      checked={enquiry.handled}
                      onChange={(event) => void setHandled(enquiry, event.target.checked)}
                    />
                    <span className="image-tile__meta">
                      {enquiry.handled ? "Answered" : "Mark answered"}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
