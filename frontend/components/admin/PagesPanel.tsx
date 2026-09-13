"use client";

import pages from "@/lib/pages.json";
import type { Page } from "@/lib/types";

/**
 * The standing pages.
 *
 * The API has no endpoint for page copy, so it ships with the site in
 * `lib/pages.json` and changes with a deploy. Listed here, read only, so the
 * console still accounts for every page on the site and says where to edit it.
 */
export function PagesPanel() {
  return (
    <>
      <p className="admin-note">
        Page copy (the atelier, care, FAQs, legal pages and the rest) is not held by the
        API. It is part of the website itself, in <code>lib/pages.json</code>, and is
        changed by a developer and a deploy. Blocks marked TODO(client) are hidden from
        the site until the copy is supplied.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(pages as Page[]).map((page) => (
            <tr key={page.slug}>
              <td>{page.slug}</td>
              <td>{page.title}</td>
              <td>{page.body.includes("TODO(client)") ? "Awaiting client copy" : "Complete"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
