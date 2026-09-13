"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi, type AdminMaterial, type MaterialGroup } from "@/lib/admin";
import { SlotEditor } from "./ImagesPanel";
import { DRAFT_SAVED, PanelProps, StatusLine, usePanelStatus } from "./common";

const GROUPS: MaterialGroup[] = ["Stone", "Timber", "Metal"];

export function MaterialsPanel({ onUnauthorised, onDraftChanged }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [note, setNote] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await adminApi.materials();
      setMaterials(body.materials);
      setNote(body.note);
      // The list is grouped Stone, Timber, Metal, so open on the first one shown.
      const first = GROUPS.map((g) => body.materials.find((m) => m.group === g)).find(Boolean);
      setSelectedSlug((current) => current ?? first?.slug ?? null);
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = materials.find((m) => m.slug === selectedSlug) ?? null;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await adminApi.createMaterial({
        name: String(form.get("name") ?? "").trim(),
        group: String(form.get("group")) as MaterialGroup,
      });
      setMaterials((current) => [...current, created]);
      setSelectedSlug(created.slug);
      formElement.reset();
      say(`${created.name} added. ${DRAFT_SAVED}`);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    try {
      const updated = await adminApi.updateMaterial(selected.slug, {
        name: text("name"),
        group: text("group") as MaterialGroup,
        attributes: text("attributes"),
        swatch: text("swatch"),
        description: text("description"),
      });
      setMaterials((current) => current.map((m) => (m.slug === updated.slug ? updated : m)));
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function remove(material: AdminMaterial) {
    if (!window.confirm(`Remove ${material.name} from the library?`)) return;
    try {
      await adminApi.deleteMaterial(material.slug);
      setMaterials((current) => current.filter((m) => m.slug !== material.slug));
      setSelectedSlug(null);
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function saveNote(value: string) {
    if (value === note) return;
    try {
      await adminApi.updateMaterialsNote(value);
      setNote(value);
      say(DRAFT_SAVED);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  return (
    <div className="admin__grid">
      <div>
        <ul className="admin-list">
          {GROUPS.map((group) => (
            <li key={group} style={{ borderBottom: "none" }}>
              <p className="admin-field" style={{ padding: "12px 8px 4px", margin: 0 }}>
                <label>{group}</label>
              </p>
              <ul className="admin-list" style={{ borderTop: "none", maxHeight: "none" }}>
                {materials
                  .filter((m) => m.group === group)
                  .map((material) => (
                    <li key={material.slug}>
                      <button
                        type="button"
                        data-active={material.slug === selectedSlug}
                        onClick={() => setSelectedSlug(material.slug)}
                      >
                        <span
                          className="swatch-dot"
                          style={{ backgroundColor: material.swatch }}
                          aria-hidden="true"
                        />
                        {material.name}
                        <span className="meta">{material.attributes}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>

        <h2 className="admin-heading">Add a material</h2>
        <form className="admin-form" onSubmit={create}>
          <div className="admin-field">
            <label htmlFor="m-new-name">Name</label>
            <input id="m-new-name" name="name" required maxLength={120} />
          </div>
          <div className="admin-field">
            <label htmlFor="m-new-group">Group</label>
            <select id="m-new-group" name="group" defaultValue="Stone">
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="admin-actions">
            <button type="submit" className="admin-button">
              Add
            </button>
          </div>
        </form>
      </div>

      <div>
        <StatusLine status={status} tone={tone} />

        <div className="admin-field" style={{ maxWidth: 640, marginBottom: 32 }}>
          <label htmlFor="m-note">Note at the top of the Materials page</label>
          <textarea
            id="m-note"
            key={note}
            defaultValue={note}
            onBlur={(event) => saveNote(event.target.value)}
          />
        </div>

        {selected && (
          <>
            <form className="admin-form" onSubmit={save} key={selected.slug}>
              <p className="admin-note">
                /atelier/materials/{selected.slug}. Pieces refer to a material by its
                name, so renaming one here leaves pieces that use the old name marked
                &ldquo;not in library&rdquo; until they are updated.
              </p>
              <div className="row">
                <div className="admin-field">
                  <label htmlFor="m-name">Name</label>
                  <input id="m-name" name="name" defaultValue={selected.name} required />
                </div>
                <div className="admin-field">
                  <label htmlFor="m-group">Group</label>
                  <select id="m-group" name="group" defaultValue={selected.group}>
                    {GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="admin-field">
                  <label htmlFor="m-attributes">Attributes</label>
                  <input
                    id="m-attributes"
                    name="attributes"
                    defaultValue={selected.attributes}
                    placeholder="Marble · Italy"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="m-swatch">Swatch colour</label>
                  <input
                    id="m-swatch"
                    name="swatch"
                    type="color"
                    defaultValue={selected.swatch}
                    style={{ height: 36, padding: 2 }}
                  />
                </div>
              </div>
              <div className="admin-field">
                <label htmlFor="m-description">Description</label>
                <textarea
                  id="m-description"
                  name="description"
                  defaultValue={selected.description}
                />
              </div>
              <div className="admin-actions">
                <button type="submit" className="admin-button">
                  Save to draft
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--quiet"
                  onClick={() => remove(selected)}
                >
                  Remove material
                </button>
              </div>
            </form>

            <h2 className="admin-heading">Sample photograph</h2>
            <SlotEditor
              key={`material.${selected.slug}`}
              slotKey={`material.${selected.slug}`}
              ratio="3/2"
              onMessage={say}
              onError={report}
            />
          </>
        )}
      </div>
    </div>
  );
}
