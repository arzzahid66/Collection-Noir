"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminApi,
  type AdminCategory,
  type AdminMaterial,
  type AdminProduct,
} from "@/lib/admin";
import { SlotEditor } from "./ImagesPanel";
import { DRAFT_SAVED, PanelProps, StatusLine, usePanelStatus } from "./common";

/**
 * Pieces: every piece in the draft, hidden ones included.
 *
 * A piece is public only when its status is live and it has a price. Both
 * are shown against each piece in the list, so a piece that is missing from
 * the site says why.
 */
export function ProductsPanel({ onUnauthorised, onDraftChanged }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c, m] = await Promise.all([
        adminApi.products(),
        adminApi.categories(),
        adminApi.materials(),
      ]);
      setProducts(p);
      setCategories(c);
      setMaterials(m.materials);
      setSelectedSlug((current) => current ?? p[0]?.slug ?? null);
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => products.find((p) => p.slug === selectedSlug) ?? null,
    [products, selectedSlug],
  );

  const replace = (updated: AdminProduct) =>
    setProducts((current) => current.map((p) => (p.slug === updated.slug ? updated : p)));

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await adminApi.createProduct({
        name: String(form.get("name") ?? "").trim(),
        category: String(form.get("category") ?? ""),
        status: "paused",
      });
      setProducts((current) => [...current, created]);
      setSelectedSlug(created.slug);
      setCreating(false);
      say(`${created.name} added as paused. Fill it in, then set it live and publish.`);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  async function remove(product: AdminProduct) {
    if (!window.confirm(`Remove ${product.name} (${product.slug})? It leaves the site on publish.`)) {
      return;
    }
    try {
      await adminApi.deleteProduct(product.slug);
      setProducts((current) => current.filter((p) => p.slug !== product.slug));
      setSelectedSlug(null);
      say(`${product.name} removed from the draft.`);
      onDraftChanged();
    } catch (error) {
      report(error);
    }
  }

  return (
    <div className="admin__grid">
      <div>
        <div className="admin-actions" style={{ marginBottom: 12 }}>
          <button type="button" className="admin-button" onClick={() => setCreating(true)}>
            Add a piece
          </button>
        </div>
        <ul className="admin-list">
          {categories.map((category) => {
            const inCategory = products.filter((p) => p.category === category.slug);
            return (
              <li key={category.slug} style={{ borderBottom: "none" }}>
                <p className="admin-field" style={{ padding: "12px 8px 4px", margin: 0 }}>
                  <label>
                    {category.name} · {category.ratio}
                  </label>
                </p>
                <ul className="admin-list" style={{ borderTop: "none", maxHeight: "none" }}>
                  {inCategory.map((product) => (
                    <li key={product.slug}>
                      <button
                        type="button"
                        data-active={product.slug === selectedSlug && !creating}
                        onClick={() => {
                          setCreating(false);
                          setSelectedSlug(product.slug);
                        }}
                      >
                        {product.name}
                        {product.subtitle ? `, ${product.subtitle.toLowerCase()}` : ""}
                        <span className="meta">
                          {visibility(product)}
                        </span>
                      </button>
                    </li>
                  ))}
                  {inCategory.length === 0 && (
                    <li>
                      <span className="meta" style={{ padding: "8px", display: "block" }}>
                        No pieces
                      </span>
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <StatusLine status={status} tone={tone} />

        {creating ? (
          <form className="admin-form" onSubmit={create}>
            <p className="admin-note">
              A new piece starts paused, so nothing appears on the site until it has a
              price, is set live and the draft is published. Its web address is made from
              the name and never changes afterwards.
            </p>
            <div className="row">
              <div className="admin-field">
                <label htmlFor="new-name">Name</label>
                <input id="new-name" name="name" required maxLength={120} autoFocus />
              </div>
              <div className="admin-field">
                <label htmlFor="new-category">Collection</label>
                <select id="new-category" name="category" required>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="admin-actions">
              <button type="submit" className="admin-button">
                Create
              </button>
              <button
                type="button"
                className="admin-button admin-button--quiet"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : !selected ? (
          <p className="admin-status">Choose a piece.</p>
        ) : (
          <ProductEditor
            key={selected.slug}
            product={selected}
            products={products}
            categories={categories}
            materials={materials}
            onSaved={(updated) => {
              replace(updated);
              say(DRAFT_SAVED);
              onDraftChanged();
            }}
            onError={report}
            onRemove={() => remove(selected)}
            onImageMessage={say}
          />
        )}
      </div>
    </div>
  );
}

function visibility(product: AdminProduct): string {
  const reasons = [
    product.status !== "live" ? "paused" : null,
    product.price_from === null ? "no price" : null,
  ].filter(Boolean);
  return reasons.length ? `Hidden · ${reasons.join(", ")}` : "Live";
}

function ProductEditor({
  product,
  products,
  categories,
  materials,
  onSaved,
  onError,
  onRemove,
  onImageMessage,
}: {
  product: AdminProduct;
  products: AdminProduct[];
  categories: AdminCategory[];
  materials: AdminMaterial[];
  onSaved: (product: AdminProduct) => void;
  onError: (error: unknown) => void;
  onRemove: () => void;
  onImageMessage: (message: string) => void;
}) {
  const [stones, setStones] = useState<string[]>(product.stones);
  const [related, setRelated] = useState<string[]>(product.related);
  const [busy, setBusy] = useState(false);

  const others = products.filter((p) => p.slug !== product.slug);
  const known = new Set(materials.map((m) => m.name));
  const ratio = categories.find((c) => c.slug === product.category)?.ratio ?? "4/5";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const price = text("price_from").replace(/[£,\s]/g, "");

    if (price !== "" && !/^\d+(\.\d+)?$/.test(price)) {
      onError(new Error("The price must be a number, for example 6750."));
      return;
    }

    setBusy(true);
    try {
      onSaved(
        await adminApi.updateProduct(product.slug, {
          name: text("name"),
          subtitle: text("subtitle"),
          category: text("category"),
          // Blank means no confirmed price, which keeps the piece off the site.
          price_from: price === "" ? null : Number(price),
          status: text("status") === "live" ? "live" : "paused",
          lead: text("lead"),
          base: text("base"),
          dimensions: text("dimensions"),
          description: text("description"),
          fixedFinish: form.get("fixedFinish") === "on",
          cross: text("cross") || null,
          stones,
          related: related.filter(Boolean).slice(0, 3),
        }),
      );
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: number) {
    setStones((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  }

  return (
    <>
      <p className="admin-note">
        <strong>{product.name}</strong> · /collection/{product.category}/{product.slug} ·{" "}
        {visibility(product)}. Changes are saved to the draft and reach the site when the
        draft is published.
      </p>

      <form className="admin-form" onSubmit={save}>
        <div className="row">
          <Field label="Name" name="name" value={product.name} required />
          <Field label="Subtitle" name="subtitle" value={product.subtitle} hint="Dining table" />
        </div>

        <div className="row">
          <div className="admin-field">
            <label htmlFor="p-category">Collection</label>
            <select id="p-category" name="category" defaultValue={product.category}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="p-status">Status</label>
            <select id="p-status" name="status" defaultValue={product.status}>
              <option value="live">Live</option>
              <option value="paused">Paused (hidden)</option>
            </select>
          </div>
        </div>

        <div className="row">
          <Field
            label="Starting price, £"
            name="price_from"
            value={product.price_from === null ? "" : String(product.price_from)}
            hint="Whole pounds. Blank hides the piece."
          />
          <Field label="Lead time" name="lead" value={product.lead} hint="12-16 weeks" />
        </div>

        <div className="row">
          <Field label="Base" name="base" value={product.base} hint="Detachable pedestal" />
          <Field
            label="Dimensions"
            name="dimensions"
            value={product.dimensions}
            hint="Separate measurements with /"
          />
        </div>

        <div className="admin-field">
          <label htmlFor="p-description">Description</label>
          <textarea
            id="p-description"
            name="description"
            style={{ minHeight: 180 }}
            defaultValue={product.description}
          />
        </div>

        <div className="admin-field">
          <label>Materials</label>
          <span className="hint">The first is the one in the photograph.</span>
          <ul className="admin-list" style={{ maxHeight: "none" }}>
            {stones.map((stone, index) => (
              <li key={`${stone}-${index}`} className="admin-row">
                <span>
                  {stone}
                  {index === 0 && <span className="pill">Shown</span>}
                  {!known.has(stone) && <span className="pill">Not in library</span>}
                </span>
                <span>
                  <button
                    type="button"
                    className="admin-button--link"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${stone} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-button--link"
                    disabled={index === stones.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${stone} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-button--link"
                    onClick={() => setStones((s) => s.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <select
            value=""
            onChange={(event) => {
              const name = event.target.value;
              if (name && !stones.includes(name)) setStones((s) => [...s, name]);
            }}
          >
            <option value="">Add a material…</option>
            {materials
              .filter((m) => !stones.includes(m.name))
              .map((m) => (
                <option key={m.slug} value={m.name}>
                  {m.group} · {m.name}
                </option>
              ))}
          </select>
        </div>

        <div className="admin-field">
          <label>
            <input type="checkbox" name="fixedFinish" defaultChecked={product.fixedFinish} />{" "}
            Fixed finish: only the size can change
          </label>
        </div>

        <div className="row">
          <div className="admin-field">
            <label htmlFor="p-cross">Part of a pair with</label>
            <select id="p-cross" name="cross" defaultValue={product.cross ?? ""}>
              <option value="">None</option>
              {others.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}, {p.subtitle.toLowerCase() || p.category}
                </option>
              ))}
            </select>
            <span className="hint">The other piece is updated to match.</span>
          </div>
          <div className="admin-field">
            <label>Also consider (up to three)</label>
            {[0, 1, 2].map((i) => (
              <select
                key={i}
                value={related[i] ?? ""}
                onChange={(event) =>
                  setRelated((current) => {
                    const next = [...current];
                    next[i] = event.target.value;
                    return next.filter(Boolean);
                  })
                }
                style={{ marginBottom: 6 }}
              >
                <option value="">None</option>
                {others.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}, {p.subtitle.toLowerCase() || p.category}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-button" disabled={busy}>
            {busy ? "Saving" : "Save to draft"}
          </button>
          <button type="button" className="admin-button admin-button--quiet" onClick={onRemove}>
            Remove piece
          </button>
        </div>
      </form>

      <h2 className="admin-heading">Photographs</h2>
      <SlotEditor
        slotKey={`product.${product.slug}`}
        ratio={ratio}
        onMessage={onImageMessage}
        onError={onError}
      />
    </>
  );
}

function Field({
  label,
  name,
  value,
  hint,
  required,
}: {
  label: string;
  name: string;
  value: string;
  hint?: string;
  required?: boolean;
}) {
  const id = `p-${name}`;
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} defaultValue={value} required={required} placeholder={hint} />
    </div>
  );
}
