"use client";

import type {
  Category,
  Enquiry,
  ImageRef,
  ImageRole,
  Material,
  Page,
  ProductDetail,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Admin API client.
 *
 * Every request carries the session cookie. A 401 means the session has gone,
 * which the console turns back into the sign in screen rather than a silent
 * failure.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers:
      init.body instanceof FormData
        ? init.headers
        : { "content-type": "application/json", ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep the default */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const body = (payload: unknown) => JSON.stringify(payload);

export const adminApi = {
  // --- session ---
  login: (email: string, password: string) =>
    request<{ email: string }>("/api/admin/login", {
      method: "POST",
      body: body({ email, password }),
    }),
  logout: () => request<void>("/api/admin/logout", { method: "POST" }),
  session: () => request<{ email: string }>("/api/admin/session"),

  // --- categories ---
  categories: () => request<Category[]>("/api/admin/categories"),
  updateCategory: (id: number, patch: Partial<Category>) =>
    request<Category>(`/api/admin/categories/${id}`, {
      method: "PATCH",
      body: body(patch),
    }),

  // --- products ---
  products: () => request<ProductDetail[]>("/api/admin/products"),
  product: (id: number) => request<ProductDetail>(`/api/admin/products/${id}`),
  createProduct: (payload: Record<string, unknown>) =>
    request<ProductDetail>("/api/admin/products", { method: "POST", body: body(payload) }),
  updateProduct: (id: number, patch: Record<string, unknown>) =>
    request<ProductDetail>(`/api/admin/products/${id}`, {
      method: "PATCH",
      body: body(patch),
    }),
  deleteProduct: (id: number) =>
    request<void>(`/api/admin/products/${id}`, { method: "DELETE" }),

  attachImage: (productId: number, imageId: number, role: ImageRole, sortOrder = 0) =>
    request<ProductDetail>(`/api/admin/products/${productId}/images`, {
      method: "POST",
      body: body({ image_id: imageId, role, sort_order: sortOrder }),
    }),
  updateProductImage: (
    productId: number,
    linkId: number,
    imageId: number,
    role: ImageRole,
    sortOrder: number,
  ) =>
    request<ProductDetail>(`/api/admin/products/${productId}/images/${linkId}`, {
      method: "PATCH",
      body: body({ image_id: imageId, role, sort_order: sortOrder }),
    }),
  detachImage: (productId: number, linkId: number) =>
    request<void>(`/api/admin/products/${productId}/images/${linkId}`, { method: "DELETE" }),

  attachMaterial: (productId: number, materialId: number, isDefault: boolean) =>
    request<ProductDetail>(`/api/admin/products/${productId}/materials`, {
      method: "POST",
      body: body({ material_id: materialId, is_default: isDefault, sort_order: 0 }),
    }),
  detachMaterial: (productId: number, linkId: number) =>
    request<void>(`/api/admin/products/${productId}/materials/${linkId}`, { method: "DELETE" }),

  // --- images ---
  images: () => request<ImageRef[]>("/api/admin/images"),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImageRef>("/api/admin/images", { method: "POST", body: form });
  },
  updateImage: (id: number, altText: string) =>
    request<ImageRef>(`/api/admin/images/${id}`, {
      method: "PATCH",
      body: body({ alt_text: altText }),
    }),
  deleteImage: (id: number) => request<void>(`/api/admin/images/${id}`, { method: "DELETE" }),

  // --- materials ---
  materials: () => request<Material[]>("/api/materials"),
  createMaterial: (payload: Record<string, unknown>) =>
    request<Material>("/api/admin/materials", { method: "POST", body: body(payload) }),
  updateMaterial: (id: number, patch: Record<string, unknown>) =>
    request<Material>(`/api/admin/materials/${id}`, { method: "PATCH", body: body(patch) }),

  // --- pages ---
  pages: () => request<Page[]>("/api/pages"),
  savePage: (slug: string, title: string, pageBody: string) =>
    request<Page>(`/api/admin/pages/${slug}`, {
      method: "PUT",
      body: body({ title, body: pageBody }),
    }),

  // --- enquiries ---
  enquiries: () => request<Enquiry[]>("/api/admin/enquiries"),
};

/**
 * Ratio check for the image panel.
 *
 * Compares a photograph's natural ratio against its category target. The build
 * brief is explicit that inconsistent scale within a category is a photography
 * problem to flag for a reshoot rather than something to compensate for in
 * code, so this surfaces the gap at upload time instead of after launch.
 *
 * Within five per cent the image can sit near edge to edge. Beyond that it
 * will letterbox visibly, which is correct behaviour but worth knowing about.
 */
export function ratioDelta(
  image: Pick<ImageRef, "width" | "height">,
  target: "3-2" | "4-5",
): { delta: number; withinTolerance: boolean; label: string } {
  const targetRatio = target === "3-2" ? 3 / 2 : 4 / 5;
  const actual = image.height === 0 ? 0 : image.width / image.height;
  const delta = targetRatio === 0 ? 0 : (actual - targetRatio) / targetRatio;
  const withinTolerance = Math.abs(delta) <= 0.05;
  const percent = `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;
  return {
    delta,
    withinTolerance,
    label: withinTolerance
      ? `Fits the frame (${percent})`
      : `${percent} against target. This will letterbox.`,
  };
}
