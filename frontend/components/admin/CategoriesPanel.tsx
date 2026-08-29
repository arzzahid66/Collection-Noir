"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/admin";
import type { Category } from "@/lib/types";
import { PanelProps, usePanelStatus } from "./common";

export function CategoriesPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    try {
      setCategories(await adminApi.categories());
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: number, changes: Partial<Category>) {
    try {
      const updated = await adminApi.updateCategory(id, changes);
      setCategories((current) => current.map((c) => (c.id === id ? updated : c)));
      say("Saved.");
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      <p className="admin-note">
        Aspect ratio is set per category, never globally. A round dining table
        and a tall plinth are inherently different shapes, so a single frame for
        everything would force one of them to be cropped. Changing a ratio here
        reshapes every card in that category immediately.
      </p>

      {status && (
        <p className="admin-status" data-tone={tone} role="status">
          {status}
        </p>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Aspect ratio</th>
            <th>Status</th>
            <th>Pieces</th>
            <th>Intro copy</th>
            <th>Bespoke prompt</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td>
                {category.name}
                <br />
                <span className="image-tile__meta">/{category.slug}</span>
              </td>
              <td>
                <select
                  value={category.aspect_ratio}
                  onChange={(event) =>
                    patch(category.id, {
                      aspect_ratio: event.target.value as Category["aspect_ratio"],
                    })
                  }
                >
                  <option value="3-2">3:2 landscape</option>
                  <option value="4-5">4:5 portrait</option>
                </select>
              </td>
              <td>
                <select
                  value={category.status}
                  onChange={(event) =>
                    patch(category.id, {
                      status: event.target.value as Category["status"],
                    })
                  }
                >
                  <option value="live">live</option>
                  <option value="coming_soon">coming soon</option>
                  <option value="hidden">hidden</option>
                </select>
              </td>
              <td>{category.product_count}</td>
              <td style={{ minWidth: 260 }}>
                <textarea
                  defaultValue={category.intro_copy ?? ""}
                  style={{ minHeight: 70 }}
                  onBlur={(event) => {
                    if (event.target.value === (category.intro_copy ?? "")) return;
                    patch(category.id, { intro_copy: event.target.value });
                  }}
                />
              </td>
              {/* Fills the trailing cell of a short category grid, as in
                  figures 6 and 8. Held here rather than in markup so the brand
                  team can reword it without a deploy. */}
              <td style={{ minWidth: 240 }}>
                <textarea
                  defaultValue={category.bespoke_prompt ?? ""}
                  style={{ minHeight: 70 }}
                  placeholder="Need a different height or footprint?"
                  onBlur={(event) => {
                    if (event.target.value === (category.bespoke_prompt ?? "")) return;
                    patch(category.id, { bespoke_prompt: event.target.value });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
