export type AspectRatio = "3-2" | "4-5";
export type CategoryStatus = "live" | "coming_soon" | "hidden";
export type ProductStatus = "live" | "draft" | "paused";
export type PricingStatus = "from" | "poa";
export type ImageRole = "primary" | "hero" | "three_quarter" | "detail";
export type MaterialFamily = "marble" | "timber" | "metal";
export type BespokeBoxType = "standard" | "size_only";
export type EnquiryType = "general" | "product" | "trade";

export interface ImageRef {
  id: number;
  filename: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  alt_text: string | null;
  url: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  aspect_ratio: AspectRatio;
  sort_order: number;
  status: CategoryStatus;
  intro_copy: string | null;
  /** Fills the trailing cell of a short category grid, per figures 6 and 8. */
  bespoke_prompt: string | null;
  product_count: number;
  cover_image: ImageRef | null;
}

export interface Material {
  id: number;
  slug: string;
  name: string;
  family: MaterialFamily;
  description: string | null;
  finish: string | null;
  quarry: string | null;
  region: string | null;
  origin: string;
  sort_order: number;
  image: ImageRef | null;
  /**
   * Approximate colour, used only for the small swatch row on a product page.
   * A swatch stands in for the material at thumbnail size. The photograph
   * remains the honest representation, and the product page says so.
   */
  swatch_hex: string | null;
}

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  subtitle: string | null;
  price_from: number | null;
  pricing_status: PricingStatus;
  purchasable: boolean;
  status: ProductStatus;
  sort_order: number;
  category_slug: string;
  category_name: string;
  aspect_ratio: AspectRatio;
  primary_image: ImageRef | null;
}

export interface ProductImageLink {
  id: number;
  role: ImageRole;
  sort_order: number;
  image: ImageRef;
}

export interface ProductMaterialLink {
  id: number;
  is_default: boolean;
  sort_order: number;
  material: Material;
}

/**
 * A piece paired with another, for the "part of a pair" cross reference.
 * Otis coffee pairs with Otis side, Oria side with Oria plinth. Section 08.
 */
export interface CrossLink {
  slug: string;
  name: string;
  subtitle: string | null;
  category_slug: string;
  category_name: string;
}

export interface ProductDetail extends ProductSummary {
  /** Full editorial copy. */
  base_description: string | null;
  /** Construction or base note, for example "Detachable pedestal". */
  base: string | null;
  dimensions: string | null;
  lead_time_weeks: string | null;
  /** "standard", or "size_only" where the finish is fixed, as on Ida. */
  bespoke_box_type: BespokeBoxType;
  /** The raw pairing slug, edited in the console. */
  cross_link_slug: string | null;
  /** The resolved partner, present only when it is itself published. */
  cross_link: CrossLink | null;
  /** Slug based filename under /spec-sheets/, for example roma-spec-sheet.pdf */
  spec_sheet: string | null;
  care_guide: string | null;
  images: ProductImageLink[];
  materials: ProductMaterialLink[];
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  body: string;
  updated_at: string;
}

export interface Enquiry {
  id: number;
  type: EnquiryType;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  product_id: number | null;
  handled: boolean;
  created_at: string;
}
