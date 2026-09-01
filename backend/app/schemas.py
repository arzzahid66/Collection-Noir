from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

AspectRatio = Literal["3-2", "4-5"]
CategoryStatus = Literal["live", "coming_soon", "hidden"]
ProductStatus = Literal["live", "draft", "paused"]
PricingStatus = Literal["from", "poa"]
ImageRole = Literal["primary", "hero", "three_quarter", "detail"]
MaterialFamily = Literal["marble", "timber", "metal"]
EnquiryType = Literal["general", "product", "trade"]
BespokeBoxType = Literal["standard", "size_only"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------


class ImageOut(ORMModel):
    id: int
    filename: str
    mime_type: str
    width: int
    height: int
    byte_size: int
    alt_text: str | None = None
    url: str = ""


class ImageUpdate(BaseModel):
    alt_text: str | None = None


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------


class MaterialBase(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    family: MaterialFamily = "marble"
    description: str | None = None
    finish: str | None = None
    quarry: str | None = None
    region: str | None = None
    origin: str = "Italy"
    sort_order: int = 0
    image_id: int | None = None
    swatch_hex: str | None = None


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    family: MaterialFamily | None = None
    description: str | None = None
    finish: str | None = None
    quarry: str | None = None
    region: str | None = None
    origin: str | None = None
    sort_order: int | None = None
    image_id: int | None = None
    swatch_hex: str | None = None


class MaterialOut(ORMModel):
    id: int
    slug: str
    name: str
    family: str
    description: str | None
    finish: str | None
    quarry: str | None
    region: str | None
    origin: str
    sort_order: int
    image: ImageOut | None = None
    # Approximate colour for the swatch row on a product page. The photograph
    # remains the honest representation of the material.
    swatch_hex: str | None = None


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


class CategoryBase(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    aspect_ratio: AspectRatio = "4-5"
    sort_order: int = 0
    status: CategoryStatus = "live"
    intro_copy: str | None = None
    bespoke_prompt: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    aspect_ratio: AspectRatio | None = None
    sort_order: int | None = None
    status: CategoryStatus | None = None
    intro_copy: str | None = None
    bespoke_prompt: str | None = None


class CategoryOut(ORMModel):
    id: int
    slug: str
    name: str
    aspect_ratio: str
    sort_order: int
    status: str
    intro_copy: str | None
    bespoke_prompt: str | None = None
    product_count: int = 0
    cover_image: ImageOut | None = None


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


class ProductImageOut(ORMModel):
    id: int
    role: str
    sort_order: int
    image: ImageOut


class ProductMaterialOut(ORMModel):
    id: int
    is_default: bool
    sort_order: int
    material: MaterialOut


class ProductBase(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    category_id: int
    name: str = Field(min_length=1, max_length=120)
    subtitle: str | None = None
    price_from: int | None = Field(default=None, ge=0)
    pricing_status: PricingStatus = "from"
    purchasable: bool = False
    base_description: str | None = None
    dimensions: str | None = None
    lead_time_weeks: str | None = None
    base: str | None = None
    bespoke_box_type: BespokeBoxType = "standard"
    cross_link_slug: str | None = None
    spec_sheet: str | None = None
    care_guide: str | None = None
    status: ProductStatus = "draft"
    sort_order: int = 0


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    slug: str | None = None
    category_id: int | None = None
    name: str | None = None
    subtitle: str | None = None
    price_from: int | None = Field(default=None, ge=0)
    pricing_status: PricingStatus | None = None
    purchasable: bool | None = None
    base_description: str | None = None
    dimensions: str | None = None
    lead_time_weeks: str | None = None
    base: str | None = None
    bespoke_box_type: BespokeBoxType | None = None
    cross_link_slug: str | None = None
    spec_sheet: str | None = None
    care_guide: str | None = None
    status: ProductStatus | None = None
    sort_order: int | None = None


class ProductSummary(ORMModel):
    id: int
    slug: str
    name: str
    subtitle: str | None
    price_from: int | None
    pricing_status: str
    purchasable: bool
    status: str
    sort_order: int
    category_slug: str
    category_name: str
    aspect_ratio: str
    primary_image: ImageOut | None = None


class CrossLinkOut(BaseModel):
    """The paired piece behind a "part of a pair" cross reference.

    Resolved on the server so the page does not have to make a second request
    to learn the partner's category, and omitted entirely when the partner is
    not itself published.
    """

    slug: str
    name: str
    subtitle: str | None
    category_slug: str
    category_name: str


class ProductDetail(ProductSummary):
    base_description: str | None
    # Construction or base note, for example "Detachable pedestal".
    base: str | None = None
    dimensions: str | None
    lead_time_weeks: str | None
    bespoke_box_type: str = "standard"
    # The raw slug, so the console can edit the pairing, alongside the resolved
    # partner the public page renders.
    cross_link_slug: str | None = None
    cross_link: CrossLinkOut | None = None
    spec_sheet: str | None = None
    care_guide: str | None = None
    images: list[ProductImageOut] = []
    materials: list[ProductMaterialOut] = []


class ProductImageAttach(BaseModel):
    image_id: int
    role: ImageRole = "primary"
    sort_order: int = 0


class ProductMaterialAttach(BaseModel):
    material_id: int
    is_default: bool = False
    sort_order: int = 0


class ReorderRequest(BaseModel):
    """Ordered list of record ids. Position in the list becomes sort_order."""

    ids: list[int]


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------


class PageOut(ORMModel):
    id: int
    slug: str
    title: str
    body: str
    updated_at: datetime


class PageUpsert(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


# ---------------------------------------------------------------------------
# Enquiries
# ---------------------------------------------------------------------------


class EnquiryCreate(BaseModel):
    type: EnquiryType = "general"
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = None
    company: str | None = None
    message: str = Field(min_length=1)
    product_id: int | None = None


class EnquiryOut(ORMModel):
    id: int
    type: str
    name: str
    email: str
    phone: str | None
    company: str | None
    message: str
    product_id: int | None
    handled: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


class SessionOut(BaseModel):
    email: str
    authenticated: bool = True
