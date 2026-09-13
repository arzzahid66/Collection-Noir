"use client";

/**
 * Admin API client for the Collection Noir API (`/api/v1/admin`, `/api/v1/auth`).
 *
 * Sign in returns a short lived access token, held here in memory and never in
 * storage, and sets the refresh token as an HttpOnly cookie on
 * `/api/v1/auth`. Requests go through the Next.js /api rewrite, so that cookie
 * belongs to this site's own origin and survives a reload.
 *
 * A 401 is answered with one refresh and one retry. Refresh rotates the
 * cookie and the server treats a reused one as stolen, so concurrent 401s
 * share a single refresh rather than each starting their own.
 *
 * Catalogue edits land in a draft. Nothing reaches the public site until the
 * draft is published, with one exception: image uploads apply at once.
 */

// --- wire shapes -------------------------------------------------------------------

export type Ratio = "3/2" | "4/5";
export type PieceStatus = "live" | "paused";
export type MaterialGroup = "Stone" | "Timber" | "Metal";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AdminCategory {
  slug: string;
  name: string;
  ratio: Ratio;
  description: string;
}

export interface AdminProduct {
  slug: string;
  name: string;
  category: string;
  subtitle: string;
  price_from: number | null;
  base: string;
  dimensions: string;
  lead: string;
  /** Material names, not slugs. The first is the one in the photograph. */
  stones: string[];
  description: string;
  status: PieceStatus;
  cross: string | null;
  related: string[];
  fixedFinish: boolean;
}

export interface AdminMaterial {
  slug: string;
  name: string;
  group: MaterialGroup;
  attributes: string;
  swatch: string;
  description: string;
}

export interface SlotImage {
  id: string;
  width: number;
  height: number;
  status: "processing" | "ready" | "failed";
  focal_point: { x: number; y: number };
  fallback: string;
  dominant_colour?: string;
}

export interface ImageSlot {
  key: string;
  name?: string;
  page?: string;
  ratio: string;
  status: string;
  fit: string;
  fill: string;
  image: SlotImage | null;
  gallery: SlotImage[];
}

interface ChangeSet {
  created: string[];
  updated: string[];
  deleted: string[];
  unchanged: number;
}

export interface DraftDiff {
  draftRevision: number;
  publishedVersionId: string | null;
  hasChanges: boolean;
  changes: {
    categories: ChangeSet;
    products: ChangeSet;
    materials: ChangeSet;
    materialsNoteChanged: boolean;
    warnings: string[];
    /** Rules that would refuse the publish. */
    violations: { code: string; message: string; entity: string; slug: string }[];
  };
}

export interface Submission {
  id: string;
  kind: "enquiry" | "trade";
  at: string;
  read: boolean;
  regarding: string;
  fields: Record<string, string>;
  email: string | null;
  discarded: boolean;
  discardReason: string | null;
}

// --- transport ---------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;
let refreshing: Promise<AdminUser | null> | null = null;
/** The draft revision last seen, sent back as If-Match on catalogue writes. */
let revision: number | null = null;

async function toError(response: Response): Promise<ApiError> {
  let code = "http_error";
  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.error?.message === "string") message = body.error.message;
    if (typeof body?.error?.code === "string") code = body.error.code;
  } catch {
    /* keep the defaults */
  }
  return new ApiError(response.status, code, message);
}

function remember(response: Response) {
  const header = response.headers.get("X-Draft-Revision");
  if (header && !Number.isNaN(Number(header))) revision = Number(header);
}

async function takeSession(response: Response): Promise<AdminUser> {
  const body = await response.json();
  accessToken = body.accessToken;
  return body.user as AdminUser;
}

/** Exchanges the refresh cookie for a new access token, once at a time. */
function refresh(): Promise<AdminUser | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      return await takeSession(response);
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Options {
  method?: string;
  json?: unknown;
  form?: FormData;
  /** Send the last seen draft revision, so a stale editor cannot overwrite. */
  guarded?: boolean;
}

async function send(path: string, options: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (options.json !== undefined) headers["content-type"] = "application/json";
  if (options.guarded && revision !== null) headers["If-Match"] = `W/"draft-${revision}"`;
  return fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers,
    // Multipart sets no content-type, so the browser adds the boundary.
    body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
  });
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && (await refresh())) {
    response = await send(path, options);
  }
  if (!response.ok) throw await toError(response);
  remember(response);
  return (await response.json()) as T;
}

// --- API ---------------------------------------------------------------------------

const enc = encodeURIComponent;

export const adminApi = {
  // session
  async login(email: string, password: string): Promise<AdminUser> {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw await toError(response);
    return takeSession(response);
  },
  /** Resumes a session from the refresh cookie after a reload. */
  restore: (): Promise<AdminUser | null> => refresh(),
  async logout(): Promise<void> {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
      () => undefined,
    );
    accessToken = null;
  },

  // draft
  async diff(): Promise<DraftDiff> {
    const diff = await request<DraftDiff>("/admin/draft/diff");
    revision = diff.draftRevision;
    return diff;
  },
  publish: (note = "") =>
    request<{ publishedVersionId: string }>(`/admin/draft/publish?note=${enc(note)}`, {
      method: "POST",
      guarded: true,
    }),
  discard: () => request<{ discarded: boolean }>("/admin/draft/discard", { method: "POST", guarded: true }),

  // collections
  categories: async () =>
    (await request<{ categories: AdminCategory[] }>("/admin/categories")).categories,
  createCategory: (payload: { name: string; ratio: Ratio; description: string }) =>
    request<AdminCategory>("/admin/categories", { method: "POST", json: payload, guarded: true }),
  updateCategory: (slug: string, patch: Partial<Omit<AdminCategory, "slug">>) =>
    request<AdminCategory>(`/admin/categories/${enc(slug)}`, {
      method: "PATCH",
      json: patch,
      guarded: true,
    }),
  deleteCategory: (slug: string) =>
    request(`/admin/categories/${enc(slug)}`, { method: "DELETE", guarded: true }),
  reorderCategories: (order: string[]) =>
    request("/admin/categories/reorder", { method: "POST", json: { order }, guarded: true }),

  // pieces
  products: async () => (await request<{ products: AdminProduct[] }>("/admin/products")).products,
  createProduct: (payload: Partial<AdminProduct> & { name: string; category: string }) =>
    request<AdminProduct>("/admin/products", { method: "POST", json: payload, guarded: true }),
  updateProduct: (slug: string, patch: Partial<Omit<AdminProduct, "slug">>) =>
    request<AdminProduct>(`/admin/products/${enc(slug)}`, {
      method: "PATCH",
      json: patch,
      guarded: true,
    }),
  deleteProduct: (slug: string) =>
    request(`/admin/products/${enc(slug)}`, { method: "DELETE", guarded: true }),

  // materials
  materials: () => request<{ materials: AdminMaterial[]; note: string }>("/admin/materials"),
  createMaterial: (payload: Partial<Omit<AdminMaterial, "slug">> & { name: string }) =>
    request<AdminMaterial>("/admin/materials", { method: "POST", json: payload, guarded: true }),
  updateMaterial: (slug: string, patch: Partial<Omit<AdminMaterial, "slug">>) =>
    request<AdminMaterial>(`/admin/materials/${enc(slug)}`, {
      method: "PATCH",
      json: patch,
      guarded: true,
    }),
  deleteMaterial: (slug: string) =>
    request(`/admin/materials/${enc(slug)}`, { method: "DELETE", guarded: true }),
  updateMaterialsNote: (note: string) =>
    request("/admin/materials/note", { method: "PATCH", json: { note }, guarded: true }),

  // image slots (live immediately, no draft)
  slots: async () => (await request<{ slots: ImageSlot[] }>("/admin/images")).slots,
  slot: (key: string) => request<ImageSlot>(`/admin/images/${key}`),
  upload(key: string, file: File, append: boolean) {
    const form = new FormData();
    form.append("file", file);
    form.append("append", String(append));
    return request<ImageSlot>(`/admin/images/${key}`, { method: "PUT", form });
  },
  clearSlot: (key: string) => request(`/admin/images/${key}`, { method: "DELETE" }),
  focalPoint: (key: string, x: number, y: number) =>
    request<ImageSlot>(`/admin/image-slots/${key}/focal-point`, {
      method: "POST",
      json: { x, y },
    }),

  // inbox
  submissions: (discarded = false) =>
    request<{ total: number; unread: number; submissions: Submission[] }>(
      `/admin/submissions?limit=200&discarded=${discarded}`,
    ),
  markRead: (id: string, read: boolean) =>
    request<Submission>(`/admin/submissions/${enc(id)}`, { method: "PATCH", json: { read } }),
  deleteSubmission: (id: string) =>
    request(`/admin/submissions/${enc(id)}`, { method: "DELETE" }),
  async exportCsv(): Promise<Blob> {
    let response = await send("/admin/submissions/export.csv", {});
    if (response.status === 401 && (await refresh())) {
      response = await send("/admin/submissions/export.csv", {});
    }
    if (!response.ok) throw await toError(response);
    return response.blob();
  },
};

/**
 * Ratio check for an image slot.
 *
 * The server never crops. Within five per cent of its frame a photograph sits
 * near edge to edge; beyond that it letterboxes onto the mount colour, which
 * is correct but worth knowing before it goes live.
 */
export function ratioDelta(
  image: Pick<SlotImage, "width" | "height">,
  target: string,
): { withinTolerance: boolean; label: string } {
  const [w, h] = target.split("/").map(Number);
  const targetRatio = w && h ? w / h : 1;
  const actual = image.height === 0 ? 0 : image.width / image.height;
  const delta = (actual - targetRatio) / targetRatio;
  const withinTolerance = Math.abs(delta) <= 0.05;
  const percent = `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;
  return {
    withinTolerance,
    label: withinTolerance
      ? `Fits the ${target} frame (${percent})`
      : `${percent} against ${target}. This will letterbox.`,
  };
}
