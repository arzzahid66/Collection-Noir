"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi, type AdminCategory, type Ratio } from "@/lib/admin";
import { DRAFT_SAVED, PanelProps, StatusLine, usePanelStatus } from "./common";

export function CategoriesPanel({ onUnauthorised, onDraftChanged }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [categories, setCategories] = useState<AdminCategory[]>([]);

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

  async function patch(slug: string, changes: Partial<Omit<AdminCategory, "slug">>) {
    try {
      const updated = await adminApi.updateCategory(slug, changes);
      setCategories((current) => current.map((c) => (c.slug === slug ? updated : c)));
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function move(index: number, by: number) {
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    try {
      await adminApi.reorderCategories(next.map((c) => c.slug));
      setCategories(next);
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function remove(category: AdminCategory) {
    if (!window.confirm(`Remove the ${category.name} collection?`)) return;
    try {
      await adminApi.deleteCategory(category.slug);
      setCategories((current) => current.filter((c) => c.slug !== category.slug));
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      // A collection that still holds pieces is refused, with the reason.
      report(error);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await adminApi.createCategory({
        name: String(form.get("name") ?? "").trim(),
        ratio: String(form.get("ratio")) as Ratio,
        description: String(form.get("description") ?? "").trim(),
      });
      setCategories((current) => [...current, created]);
      formElement.reset();
      say(`${created.name} added. ${DRAFT_SAVED}`);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      <p className="admin-note">
        The frame ratio is set per collection, never globally: a round dining table and a
        tall plinth are different shapes. Every card in a collection uses its ratio, and
        photographs letterbox inside it rather than being cropped. A collection with no
        live pieces shows as in preparation.
      </p>

      <StatusLine status={status} tone={tone} />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Collection</th>
            <th>Frame</th>
            <th>Description</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category.slug}>
              <td style={{ whiteSpace: "nowrap" }}>
                <button
                  type="button"
                  className="admin-button--link"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${category.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-button--link"
                  disabled={index === categories.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${category.name} down`}
                >
                  ↓
                </button>
              </td>
              <td>
                <input
                  defaultValue={category.name}
                  aria-label="Name"
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== category.name) void patch(category.slug, { name });
                  }}
                />
                <br />
                <span className="image-tile__meta">/collection/{category.slug}</span>
              </td>
              <td>
                <select
                  value={category.ratio}
                  aria-label="Frame ratio"
                  onChange={(event) =>
                    patch(category.slug, { ratio: event.target.value as Ratio })
                  }
                >
                  <option value="3/2">3:2 landscape</option>
                  <option value="4/5">4:5 portrait</option>
                </select>
              </td>
              <td style={{ minWidth: 280 }}>
                <textarea
                  defaultValue={category.description}
                  aria-label="Description"
                  style={{ minHeight: 70 }}
                  onBlur={(event) => {
                    if (event.target.value !== category.description) {
                      void patch(category.slug, { description: event.target.value });
                    }
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="admin-button admin-button--quiet"
                  onClick={() => remove(category)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="admin-heading">Add a collection</h2>
      <form className="admin-form" onSubmit={create}>
        <div className="row">
          <div className="admin-field">
            <label htmlFor="c-name">Name</label>
            <input id="c-name" name="name" required maxLength={120} />
          </div>
          <div className="admin-field">
            <label htmlFor="c-ratio">Frame</label>
            <select id="c-ratio" name="ratio" defaultValue="4/5">
              <option value="3/2">3:2 landscape</option>
              <option value="4/5">4:5 portrait</option>
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label htmlFor="c-description">Description</label>
          <textarea id="c-description" name="description" />
        </div>
        <div className="admin-actions">
          <button type="submit" className="admin-button">
            Add collection
          </button>
        </div>
      </form>
    </>
  );
}
