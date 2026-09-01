from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# Aspect ratios are held as data on the category row rather than hardcoded in
# CSS, because ratio is a per-category decision and the set of categories is
# editable from the admin console.
ASPECT_RATIOS = ("3-2", "4-5")

CATEGORY_STATUSES = ("live", "coming_soon", "hidden")
PRODUCT_STATUSES = ("live", "draft", "paused")
PRICING_STATUSES = ("from", "poa")
IMAGE_ROLES = ("primary", "hero", "three_quarter", "detail")
MATERIAL_FAMILIES = ("marble", "timber", "metal")
ENQUIRY_TYPES = ("general", "product", "trade")

# Drives the copy in the bespoke panel on a product page. A piece whose finish
# is fixed, such as Ida, can only be varied by size.
BESPOKE_BOX_TYPES = ("standard", "size_only")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    # "3-2" (landscape) or "4-5" (portrait). Drives the grid card shape.
    aspect_ratio: Mapped[str] = mapped_column(String(8), default="4-5")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="live")
    intro_copy: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The prompt that fills the trailing cell of a short category grid, as on
    # the console table and plinth pages in the approved mockups. Held as data
    # rather than written into the template, because it is copy and copy is
    # edited in the console.
    bespoke_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    products: Mapped[list[Product]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="Product.sort_order",
    )


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    family: Mapped[str] = mapped_column(String(20), default="marble")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    finish: Mapped[str | None] = mapped_column(String(160), nullable=True)
    # Provenance is stated specifically. Quarry and region, never just the
    # country on its own.
    quarry: Mapped[str | None] = mapped_column(String(160), nullable=True)
    region: Mapped[str | None] = mapped_column(String(160), nullable=True)
    origin: Mapped[str] = mapped_column(String(120), default="Italy")

    # Approximate colour of the material, used only for the small swatch row on
    # a product page. A swatch stands in for the material at thumbnail size; the
    # photograph remains the honest representation, and the product page says so.
    swatch_hex: Mapped[str | None] = mapped_column(String(9), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    image_id: Mapped[int | None] = mapped_column(
        ForeignKey("images.id", ondelete="SET NULL"), nullable=True
    )

    image: Mapped[Image | None] = relationship(foreign_keys=[image_id])


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        # The catalogue reuses names across categories: Otis is both a coffee
        # table and a side table, Oria is both a side table and a plinth.
        # Slugs are therefore scoped to a category rather than to the site.
        UniqueConstraint("category_id", "slug", name="uq_product_category_slug"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # Whole pounds. Every launch price is a round number ending in zero; that
    # is a business rule applied to the source data, so nothing here rounds or
    # reformats in a way that could contradict it.
    price_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricing_status: Mapped[str] = mapped_column(String(10), default="from")

    # Reserved for a future collection. No launch product sets this. When true
    # the product page renders "Add to Order" in place of "Enquire".
    purchasable: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    base_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimensions: Mapped[str | None] = mapped_column(String(240), nullable=True)
    lead_time_weeks: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Construction note printed in the spec table, e.g. "Detachable pedestal".
    base: Mapped[str | None] = mapped_column(String(160), nullable=True)

    bespoke_box_type: Mapped[str] = mapped_column(
        String(20), default="standard", server_default="standard"
    )

    # Slug of a paired piece, used for the "part of a pair" cross-reference.
    # Otis coffee pairs with Otis side, Oria side with Oria plinth. Stored as a
    # slug rather than a foreign key because the pairing is editorial and the
    # partner may not exist yet.
    cross_link_slug: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Generated documents. Paths rather than binaries, since these are rebuilt
    # from the product record whenever it changes.
    spec_sheet: Mapped[str | None] = mapped_column(String(240), nullable=True)
    care_guide: Mapped[str | None] = mapped_column(String(240), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="draft")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category] = relationship(back_populates="products")
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )
    materials: Mapped[list[ProductMaterial]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductMaterial.sort_order",
    )

    @property
    def is_publishable(self) -> bool:
        """Whether a piece appears anywhere on the public site.

        Two conditions, and both must hold:

            status == "live"   AND   price_from is not None

        Either one alone is not enough. A live piece without a confirmed price
        is withheld entirely rather than shown as price on application, and a
        priced piece that is paused or draft stays off the site regardless.

        This is the single gate for every public surface: the category grids,
        the homepage teasers, the related pieces, the pair cross reference,
        the hero photography, the sitemap and the product route itself. A
        direct URL to a piece that fails it returns 404 rather than rendering.
        Anything that lists pieces publicly calls this and nothing else.

        Two notes on what is deliberately *not* checked here:

        - Photography is not required. It was, and that single condition
          withheld the entire catalogue whenever images were unattached: a
          fully priced, fully approved piece vanished because nobody had
          linked a photograph yet. A piece with no photograph renders its
          frame as the letterbox mount with the empty-slot label, which is a
          designed state and reads as a slot waiting on an asset.
        - `pricing_status` is not consulted. The rule is about whether a
          price exists, not how it is labelled, so a "poa" row with no
          `price_from` is withheld on the same terms as any other.
        """
        if self.status != "live":
            return False
        if self.price_from is None:
            return False
        return True


class ProductMaterial(Base):
    __tablename__ = "product_materials"
    __table_args__ = (
        UniqueConstraint("product_id", "material_id", name="uq_product_material"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="materials")
    material: Mapped[Material] = relationship()


class Image(Base):
    """Photograph metadata, with the binary either in a bucket or in Postgres.

    The binaries used to live here as `bytea`, on the reasoning that Neon is
    Postgres only and one credential is simpler than two. The free tier ended
    that: 0.5 GB of storage and 5 GB of egress a month is roughly two and a
    half thousand image views, which a marketing site reaches quickly.

    So there are now two places a binary can be, and exactly one column says
    which:

    - `storage_key` set  ->  the bytes are in the bucket, `data` is NULL.
    - `storage_key` NULL ->  the bytes are in `data`, as before.

    Both are read through the same public contract, `/api/images/{id}`, which
    is what the earlier note here promised would make this migration invisible
    to the frontend. It was right, and it is: no component changed.

    Rows uploaded before the bucket existed keep working untouched, so the
    migration is a background job rather than a cutover. See app/storage.py
    and app/migrate_images.py.

    Images are stored exactly as supplied. Nothing here crops, resizes or
    re-encodes them.
    """

    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(80))
    # Deferred, and it matters more than it looks.
    #
    # Every product query eager loads its images so a card can render an alt
    # text and a URL, and none of that needs the bytes: `image_out` reads the
    # filename, the dimensions and the id, never `data`. Loaded eagerly, a
    # single request for the product list dragged the entire photographic
    # catalogue out of Postgres and across the network. With two photographs
    # attached to one piece that was eight megabytes per request, and
    # `/api/products` took between six and eleven seconds.
    #
    # Deferring it means the column is fetched only where it is actually
    # read, which is the one route that serves the binary. That route has the
    # session open when it touches `data`, so the extra SELECT is fine.
    data: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True, nullable=True)
    byte_size: Mapped[int] = mapped_column(Integer, default=0)

    # The object key in the bucket, e.g. "images/9f2c....jpg". NULL means the
    # binary is still in `data`. Not deferred: it is small, and every
    # serialisation of an image needs it to build the URL, so deferring it
    # would reintroduce exactly the per-row extra SELECT that deferring `data`
    # was meant to avoid.
    storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Natural dimensions, recorded at upload. The admin console compares these
    # against the target category ratio so off-ratio photography is visible
    # before it reaches the grid.
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)

    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def aspect(self) -> float | None:
        if not self.height:
            return None
        return self.width / self.height


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), default="primary")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="images")
    image: Mapped[Image] = relationship()


class Page(Base):
    """Editorial copy for the standing pages.

    Held in the database so wording changes need no redeploy. Body is
    markdown.
    """

    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(20), default="general")
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(240))
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    handled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product | None] = relationship()
