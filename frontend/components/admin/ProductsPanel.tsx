"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi, ratioDelta } from "@/lib/admin";
import { aspectClass } from "@/lib/format";
import type { Category, ImageRef, ImageRole, Material, ProductDetail } from "@/lib/types";
import { IMAGE_ROLES, PanelProps, ROLE_LABEL, PRODUCT_STATUSES, usePanelStatus } from "./common";

export function ProductsPanel({ onUnauthorised }: PanelProps) {
  const { status, tone, report, say } = usePanelStatus(onUnauthorised);

  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [library, setLibrary] = useState<ImageRef[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c, m, i] = await Promise.all([
        adminApi.products(),
        adminApi.categories(),
        adminApi.materials(),
        adminApi.images(),
      ]);
      setProducts(p);
      setCategories(c);
      setMaterials(m);
      setLibrary(i);
      setSelectedId((current) => current ?? p[0]?.id ?? null);
    } catch (error) {
      report(error);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );

  const refreshOne = (updated: ProductDetail) =>
    setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)));

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const rawPrice = String(form.get("price_from") ?? "").trim();

    try {
      const updated = await adminApi.updateProduct(selected.id, {
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
        subtitle: String(form.get("subtitle") ?? "") || null,
        category_id: Number(form.get("category_id")),
        // Sent as entered. Nothing here rounds, because launch prices are
        // already round numbers in the source data and reformatting could
        // contradict it.
        price_from: rawPrice === "" ? null : Number(rawPrice),
        pricing_status: String(form.get("pricing_status") ?? "from"),
        purchasable: form.get("purchasable") === "on",
        base_description: String(form.get("base_description") ?? "") || null,
        base: String(form.get("base") ?? "") || null,
        dimensions: String(form.get("dimensions") ?? "") || null,
        lead_time_weeks: String(form.get("lead_time_weeks") ?? "") || null,
        bespoke_box_type: String(form.get("bespoke_box_type") ?? "standard"),
        cross_link_slug: String(form.get("cross_link_slug") ?? "") || null,
        status: String(form.get("status") ?? "draft"),
      });
      refreshOne(updated);
      say("Saved. The public site reflects this immediately.");
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  async function attach(imageId: number, role: ImageRole) {
    if (!selected) return;
    try {
      refreshOne(await adminApi.attachImage(selected.id, imageId, role, selected.images.length));
      say("Image attached.");
    } catch (error) {
      report(error);
    }
  }

  async function detach(linkId: number) {
    if (!selected) return;
    try {
      await adminApi.detachImage(selected.id, linkId);
      refreshOne(await adminApi.product(selected.id));
      say("Image removed from this piece. It stays in the library.");
    } catch (error) {
      report(error);
    }
  }

  async function setRole(linkId: number, imageId: number, role: ImageRole, sortOrder: number) {
    if (!selected) return;
    try {
      refreshOne(
        await adminApi.updateProductImage(selected.id, linkId, imageId, role, sortOrder),
      );
    } catch (error) {
      report(error);
    }
  }

  const target = selected ? (selected.aspect_ratio as "3-2" | "4-5") : "4-5";

  const readiness = selected
    ? [
        selected.status === "live" ? null : "status is not live",
        selected.price_from === null && selected.pricing_status === "from"
          ? "no confirmed price"
          : null,
        selected.images.length === 0 ? "no photograph" : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="admin__grid">
      <div>
        <p className="admin-field" style={{ marginBottom: 10 }}>
          <label>Pieces</label>
        </p>
        <ul className="admin-list">
          {categories.map((category) => {
            const inCategory = products.filter((p) => p.category_slug === category.slug);
            if (inCategory.length === 0) return null;
            return (
              <li key={category.slug} style={{ borderBottom: "none" }}>
                <p
                  className="admin-field"
                  style={{ padding: "12px 8px 4px", margin: 0 }}
                >
                  <label>
                    {category.name} · {category.aspect_ratio}
                  </label>
                </p>
                <ul className="admin-list" style={{ borderTop: "none", maxHeight: "none" }}>
                  {inCategory.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        data-active={product.id === selectedId}
                        onClick={() => setSelectedId(product.id)}
                      >
                        {product.name}
                        <span className="meta">
                          {product.status}
                          {product.price_from === null ? " · no price" : ""}
                          {product.images.length === 0 ? " · no image" : ""}
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
        {status && (
          <p className="admin-status" data-tone={tone} role="status">
            {status}
          </p>
        )}

        {!selected ? (
          <p className="admin-status">No pieces yet.</p>
        ) : (
          <>
            <p className="admin-note">
              A piece reaches the public site only when its status is live, it
              has a confirmed price, and it has at least one photograph. This is
              what keeps an unpriced piece off the site rather than showing it
              as price on application.
              {readiness.length > 0 && (
                <>
                  {" "}
                  This piece is not published: {readiness.join(", ")}.
                </>
              )}
            </p>

            <form className="admin-form" onSubmit={saveDetails} key={selected.id}>
              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-name">Name</label>
                  <input id="p-name" name="name" defaultValue={selected.name} required />
                </div>
                <div className="admin-field">
                  <label htmlFor="p-slug">Slug</label>
                  <input id="p-slug" name="slug" defaultValue={selected.slug} required />
                  <span className="hint">
                    Scoped to its category, so the same name can be used in two
                    categories.
                  </span>
                </div>
              </div>

              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-subtitle">Subtitle</label>
                  <input
                    id="p-subtitle"
                    name="subtitle"
                    defaultValue={selected.subtitle ?? ""}
                    placeholder="Dining table"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="p-category">Category</label>
                  <select
                    id="p-category"
                    name="category_id"
                    defaultValue={
                      categories.find((c) => c.slug === selected.category_slug)?.id ?? ""
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.aspect_ratio})
                      </option>
                    ))}
                  </select>
                  <span className="hint">
                    Sets the card shape on the grid.
                  </span>
                </div>
              </div>

              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-price">Starting price, whole pounds</label>
                  <input
                    id="p-price"
                    name="price_from"
                    type="number"
                    min="0"
                    step="10"
                    defaultValue={selected.price_from ?? ""}
                    placeholder="8400"
                  />
                  <span className="hint">
                    Renders as &ldquo;Starting from £8,400&rdquo;. Launch prices
                    are round numbers ending in zero.
                  </span>
                </div>
                <div className="admin-field">
                  <label htmlFor="p-pricing">Pricing</label>
                  <select
                    id="p-pricing"
                    name="pricing_status"
                    defaultValue={selected.pricing_status}
                  >
                    <option value="from">Starting from</option>
                    <option value="poa">Price on application</option>
                  </select>
                  <span className="hint">
                    Price on application is not used at launch. It exists for
                    future flexibility only.
                  </span>
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="p-description">Description</label>
                <textarea
                  id="p-description"
                  name="base_description"
                  defaultValue={selected.base_description ?? ""}
                />
                <span className="hint">
                  A short editorial note, not sales copy. Name the material
                  before the piece.
                </span>
              </div>

              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-dimensions">Dimensions</label>
                  <input
                    id="p-dimensions"
                    name="dimensions"
                    defaultValue={selected.dimensions ?? ""}
                    placeholder="D1.3m (4 to 6 seats), H75cm"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="p-lead">Lead time, weeks</label>
                  <input
                    id="p-lead"
                    name="lead_time_weeks"
                    defaultValue={selected.lead_time_weeks ?? ""}
                    placeholder="12-16"
                  />
                  <span className="hint">
                    Dining tables 12-16. Everything else 8-10.
                  </span>
                </div>
              </div>

              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-base">Base</label>
                  <input
                    id="p-base"
                    name="base"
                    defaultValue={selected.base ?? ""}
                    placeholder="Detachable pedestal"
                  />
                  <span className="hint">
                    The construction note printed in the specification table.
                  </span>
                </div>
                <div className="admin-field">
                  <label htmlFor="p-bespoke">Bespoke panel</label>
                  <select
                    id="p-bespoke"
                    name="bespoke_box_type"
                    defaultValue={selected.bespoke_box_type}
                  >
                    <option value="standard">Standard</option>
                    <option value="size_only">Size only, finish is fixed</option>
                  </select>
                  <span className="hint">
                    Size only is for a piece made in a fixed pairing of
                    materials, as the Ida is.
                  </span>
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="p-crosslink">Paired with</label>
                <input
                  id="p-crosslink"
                  name="cross_link_slug"
                  defaultValue={selected.cross_link_slug ?? ""}
                  placeholder="otis-side"
                  list="product-slugs"
                />
                <datalist id="product-slugs">
                  {products
                    .filter((p) => p.id !== selected.id)
                    .map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.name}, {p.category_name}
                      </option>
                    ))}
                </datalist>
                <span className="hint">
                  The slug of a piece designed to sit with this one, which
                  renders a cross reference on both pages. Set it on both
                  halves. Leave empty if the piece stands alone.
                </span>
              </div>

              <div className="row">
                <div className="admin-field">
                  <label htmlFor="p-status">Status</label>
                  <select id="p-status" name="status" defaultValue={selected.status}>
                    {PRODUCT_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="p-purchasable">Call to action</label>
                  <label
                    style={{
                      textTransform: "none",
                      letterSpacing: 0,
                      fontSize: 12,
                      color: "var(--cn-ink)",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      id="p-purchasable"
                      name="purchasable"
                      type="checkbox"
                      defaultChecked={selected.purchasable}
                      style={{ width: "auto" }}
                    />
                    Add to Order
                  </label>
                  <span className="hint">
                    Leave unticked and the piece shows Enquire. Ticking it shows
                    Add to Order, which is reserved for the next collection and
                    has no checkout behind it yet. No launch piece uses it.  copy-lint-ok
                  </span>
                </div>
              </div>

              <div className="admin-actions">
                <button className="admin-button" type="submit" disabled={busy}>
                  {busy ? "Saving" : "Save piece"}
                </button>
              </div>
            </form>

            {/* --- images --- */}
            <h2 style={{ margin: "44px 0 8px", fontSize: 18 }}>
              Photography
              <span className="pill">target {selected.aspect_ratio}</span>
            </h2>
            <p className="admin-note">
              Photographs are stored and displayed exactly as supplied. Nothing
              is cropped. An image whose shape does not match the category frame
              is centred on a mount with clean margin, which is correct
              behaviour. Where the badge reads amber, the fix is a reshoot at
              the right framing rather than anything in the code.
            </p>

            {selected.images.length === 0 ? (
              <p className="admin-status">No photographs attached yet.</p>
            ) : (
              selected.images.map((link) => {
                const check = ratioDelta(link.image, target);
                return (
                  <div className="attached-image" key={link.id}>
                    <div
                      className={`attached-image__thumb ${aspectClass(selected.aspect_ratio)}`}
                      style={{ backgroundImage: `url(${link.image.url})` }}
                    />
                    <div>
                      <p className="image-tile__meta">{link.image.filename}</p>
                      <p className="image-tile__meta">
                        {link.image.width} × {link.image.height}
                      </p>
                      <span className="ratio-badge" data-ok={check.withinTolerance}>
                        {check.label}
                      </span>
                      <div className="admin-field" style={{ marginTop: 6 }}>
                        <label htmlFor={`role-${link.id}`}>Role</label>
                        <select
                          id={`role-${link.id}`}
                          value={link.role}
                          onChange={(event) =>
                            setRole(
                              link.id,
                              link.image.id,
                              event.target.value as ImageRole,
                              link.sort_order,
                            )
                          }
                        >
                          {IMAGE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-button admin-button--quiet"
                      onClick={() => detach(link.id)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}

            <div className="admin-field" style={{ marginTop: 20, maxWidth: 420 }}>
              <label htmlFor="attach-image">Attach from the library</label>
              <select
                id="attach-image"
                defaultValue=""
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (id) {
                    void attach(id, selected.images.length === 0 ? "primary" : "hero");
                    event.target.value = "";
                  }
                }}
              >
                <option value="">Choose an image</option>
                {library.map((image) => (
                  <option key={image.id} value={image.id}>
                    {image.filename} ({image.width}×{image.height})
                  </option>
                ))}
              </select>
              <span className="hint">
                Upload new photography under Images first.
              </span>
            </div>

            {/* --- materials --- */}
            <h2 style={{ margin: "44px 0 8px", fontSize: 18 }}>Materials</h2>
            {selected.materials.length === 0 ? (
              <p className="admin-status">No materials listed yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Provenance</th>
                    <th>Default</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selected.materials.map((link) => (
                    <tr key={link.id}>
                      <td>{link.material.name}</td>
                      <td>
                        {[link.material.quarry, link.material.region, link.material.origin]
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td>{link.is_default ? "Yes" : ""}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-button admin-button--quiet"
                          onClick={async () => {
                            try {
                              await adminApi.detachMaterial(selected.id, link.id);
                              refreshOne(await adminApi.product(selected.id));
                            } catch (error) {
                              report(error);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="admin-field" style={{ marginTop: 20, maxWidth: 420 }}>
              <label htmlFor="attach-material">Add a material</label>
              <select
                id="attach-material"
                defaultValue=""
                onChange={async (event) => {
                  const id = Number(event.target.value);
                  event.target.value = "";
                  if (!id) return;
                  try {
                    refreshOne(
                      await adminApi.attachMaterial(
                        selected.id,
                        id,
                        selected.materials.length === 0,
                      ),
                    );
                  } catch (error) {
                    report(error);
                  }
                }}
              >
                <option value="">Choose a material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
              <span className="hint">
                The first material added becomes the default, which is the one
                named on the product page.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
