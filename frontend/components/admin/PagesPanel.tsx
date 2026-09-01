"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/admin";
import type { Page } from "@/lib/types";
import { PanelProps, usePanelStatus } from "./common";

const GROUPS: { heading: string; prefix?: string; slugs?: string[] }[] = [
  { heading: "Home", slugs: ["home-intro", "home-bespoke"] },
  {
    heading: "Standing pages",
    slugs: [
      "atelier",
      "atelier-bespoke",
      "materials-intro",
      "care",
      "trade",
      "enquire-intro",
      "showroom",
      "press",
      "faqs",
      "sustainability",
      "accessibility",
    ],
  },
  { heading: "Legal", prefix: "legal-" },
];

export function PagesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await adminApi.pages();
      setPages(all);
      setSelectedSlug((current) => current ?? all[0]?.slug ?? null);
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = pages.find((p) => p.slug === selectedSlug) ?? null;
  const outstanding = selected ? selected.body.includes("TODO(client)") : false;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const updated = await adminApi.savePage(
        selected.slug,
        String(form.get("title") ?? ""),
        String(form.get("body") ?? ""),
      );
      setPages((current) => current.map((p) => (p.slug === updated.slug ? updated : p)));
      say("Saved. The page updates immediately, with no redeploy.");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  const groupedSlugs = (group: (typeof GROUPS)[number]) =>
    group.prefix
      ? pages.filter((p) => p.slug.startsWith(group.prefix!))
      : pages.filter((p) => group.slugs?.includes(p.slug));

  return (
    <div className="admin__grid">
      <div>
        <ul className="admin-list">
          {GROUPS.map((group) => {
            const items = groupedSlugs(group);
            if (items.length === 0) return null;
            return (
              <li key={group.heading} style={{ borderBottom: "none" }}>
                <p className="admin-field" style={{ padding: "12px 8px 4px", margin: 0 }}>
                  <label>{group.heading}</label>
                </p>
                <ul className="admin-list" style={{ borderTop: "none", maxHeight: "none" }}>
                  {items.map((page) => (
                    <li key={page.slug}>
                      <button
                        type="button"
                        data-active={page.slug === selectedSlug}
                        onClick={() => setSelectedSlug(page.slug)}
                      >
                        {page.title}
                        <span className="meta">
                          {page.slug}
                          {page.body.includes("TODO(client)") ? " · needs detail" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="admin-note">
          Page copy lives in the database, so wording changes take effect
          immediately and need no redeploy. Markdown: two hashes for a heading,
          three for a sub-heading, a blank line between paragraphs, a leading
          hyphen for a list item.
          {outstanding && (
            <>
              <br />
              <br />
              This page still contains TODO(client) placeholders. They need
              details only the business can supply, and they must be resolved
              before the page goes live.
            </>
          )}
        </p>

        {status && (
          <p className="admin-status" data-tone={tone} role="status">
            {status}
          </p>
        )}

        {selected && (
          <form className="admin-form" onSubmit={save} key={selected.slug} style={{ maxWidth: "none" }}>
            <div className="admin-field" style={{ maxWidth: 520 }}>
              <label htmlFor="page-title">Title</label>
              <input id="page-title" name="title" defaultValue={selected.title} required />
            </div>
            <div className="admin-field">
              <label htmlFor="page-body">Body</label>
              <textarea
                id="page-body"
                name="body"
                className="tall"
                defaultValue={selected.body}
              />
            </div>
            <div className="admin-actions">
              <button className="admin-button" type="submit" disabled={busy}>
                {busy ? "Saving" : "Save page"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
