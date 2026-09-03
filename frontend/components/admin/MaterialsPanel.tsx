"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/admin";
import type { ImageRef, Material } from "@/lib/types";
import { PanelProps, usePanelStatus } from "./common";

/**
 * The slug is derived rather than asked for.
 *
 * It is the material's address on the site, and a person adding "Burr Walnut"
 * has no reason to also be asked for "burr-walnut". The API rejects a
 * duplicate with a 409, which surfaces here as the message it sends back,
 * so a clash is reported rather than guessed at with a suffix.
 */
function slugFor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function MaterialsPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [library, setLibrary] = useState<ImageRef[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([adminApi.materials(), adminApi.images()]);
      setMaterials(m);
      setLibrary(i);
      setSelectedId((current) => current ?? m[0]?.id ?? null);
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = materials.find((m) => m.id === selectedId) ?? null;

  /*
   * Adding a material.
   *
   * The endpoint and the client method have both existed since the console
   * was built; nothing called them, so the library was fixed at whatever the
   * seed had put there and the three burl timbers had no way in. Only a name
   * and a family are asked for here. Everything else, including the swatch
   * colour and the photograph, is set in the form beside the list once the
   * material exists.
   */
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("new_name") ?? "").trim();
    if (!name) return;

    try {
      const created = await adminApi.createMaterial({
        slug: slugFor(name),
        name,
        family: String(data.get("new_family") ?? "marble"),
      });
      setMaterials((current) => [...current, created]);
      setSelectedId(created.id);
      form.reset();
      say(`Added ${created.name}. Set its provenance and swatch beside the list.`);
    } catch (error) {
      report(error);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const imageId = String(form.get("image_id") ?? "");
    try {
      const updated = await adminApi.updateMaterial(selected.id, {
        name: String(form.get("name") ?? ""),
        family: String(form.get("family") ?? "marble"),
        description: String(form.get("description") ?? "") || null,
        finish: String(form.get("finish") ?? "") || null,
        quarry: String(form.get("quarry") ?? "") || null,
        region: String(form.get("region") ?? "") || null,
        origin: String(form.get("origin") ?? "Italy"),
        swatch_hex: String(form.get("swatch_hex") ?? "") || null,
        image_id: imageId === "" ? null : Number(imageId),
      });
      setMaterials((current) => current.map((m) => (m.id === updated.id ? updated : m)));
      say("Saved.");
    } catch (error) {
      report(error);
    }
  }

  return (
    <div className="admin__grid">
      <div>
        <p className="admin-field" style={{ marginBottom: 10 }}>
          <label>Materials library</label>
        </p>
        <ul className="admin-list">
          {materials.map((material) => (
            <li key={material.id}>
              <button
                type="button"
                data-active={material.id === selectedId}
                onClick={() => setSelectedId(material.id)}
              >
                {material.name}
                <span className="meta">{material.family}</span>
              </button>
            </li>
          ))}
        </ul>

        <form className="admin-form" onSubmit={create} style={{ marginTop: 16 }}>
          <div className="admin-field">
            <label htmlFor="m-new-name">Add a material</label>
            <input
              id="m-new-name"
              name="new_name"
              placeholder="Burr Walnut"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="m-new-family">Family</label>
            <select id="m-new-family" name="new_family" defaultValue="timber">
              <option value="marble">marble</option>
              <option value="timber">timber</option>
              <option value="metal">metal</option>
            </select>
          </div>
          <button type="submit">Add</button>
        </form>
      </div>

      <div>
        <p className="admin-note">
          Provenance is stated by quarry and region, never by country alone. Two
          blocks from the same country can behave nothing alike, and the
          specific source is what the product page prints.
        </p>

        {status && (
          <p className="admin-status" data-tone={tone} role="status">
            {status}
          </p>
        )}

        {selected && (
          <form className="admin-form" onSubmit={save} key={selected.id}>
            <div className="row">
              <div className="admin-field">
                <label htmlFor="m-name">Name</label>
                <input id="m-name" name="name" defaultValue={selected.name} required />
              </div>
              <div className="admin-field">
                <label htmlFor="m-family">Family</label>
                <select id="m-family" name="family" defaultValue={selected.family}>
                  <option value="marble">marble</option>
                  <option value="timber">timber</option>
                  <option value="metal">metal</option>
                </select>
              </div>
            </div>

            <div className="row">
              <div className="admin-field">
                <label htmlFor="m-quarry">Quarry</label>
                <input id="m-quarry" name="quarry" defaultValue={selected.quarry ?? ""} />
              </div>
              <div className="admin-field">
                <label htmlFor="m-region">Region</label>
                <input id="m-region" name="region" defaultValue={selected.region ?? ""} />
              </div>
            </div>

            <div className="row">
              <div className="admin-field">
                <label htmlFor="m-origin">Country</label>
                <input id="m-origin" name="origin" defaultValue={selected.origin} />
              </div>
              <div className="admin-field">
                <label htmlFor="m-finish">Finish</label>
                <input id="m-finish" name="finish" defaultValue={selected.finish ?? ""} />
              </div>
            </div>

            <div className="row">
              <div className="admin-field">
                <label htmlFor="m-swatch">Swatch colour</label>
                <input
                  id="m-swatch"
                  name="swatch_hex"
                  type="color"
                  defaultValue={selected.swatch_hex ?? "#c4aa98"}
                />
                <span className="hint">
                  Used only for the small swatch row on a product page. The
                  photograph remains the honest representation of the material,
                  and the product page says so.
                </span>
              </div>
              <div className="admin-field" />
            </div>

            <div className="admin-field">
              <label htmlFor="m-description">Description</label>
              <textarea
                id="m-description"
                name="description"
                defaultValue={selected.description ?? ""}
              />
            </div>

            <div className="admin-field">
              <label htmlFor="m-image">Photograph</label>
              <select id="m-image" name="image_id" defaultValue={selected.image?.id ?? ""}>
                <option value="">None</option>
                {library.map((image) => (
                  <option key={image.id} value={image.id}>
                    {image.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-actions">
              <button className="admin-button" type="submit">
                Save material
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
