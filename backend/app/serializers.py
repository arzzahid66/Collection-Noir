"""Model to schema conversion.

Kept in one place so the shape of an image or a product is identical whether it
is being rendered on the public site or inside the admin console.
"""

from __future__ import annotations

from . import models, schemas


def image_out(image: models.Image | None) -> schemas.ImageOut | None:
    if image is None:
        return None
    return schemas.ImageOut(
        id=image.id,
        filename=image.filename,
        mime_type=image.mime_type,
        width=image.width,
        height=image.height,
        byte_size=image.byte_size,
        alt_text=image.alt_text,
        url=f"/api/images/{image.id}",
    )


def material_out(material: models.Material) -> schemas.MaterialOut:
    return schemas.MaterialOut(
        id=material.id,
        slug=material.slug,
        name=material.name,
        family=material.family,
        description=material.description,
        finish=material.finish,
        quarry=material.quarry,
        region=material.region,
        origin=material.origin,
        sort_order=material.sort_order,
        image=image_out(material.image),
        swatch_hex=material.swatch_hex,
    )


def _primary_image(product: models.Product) -> models.Image | None:
    """The photograph used on the category grid.

    Prefers an image explicitly marked `primary`, then falls back to the first
    attached image so a product is never invisible purely because nobody set
    the role.
    """
    if not product.images:
        return None
    for link in product.images:
        if link.role == "primary":
            return link.image
    return product.images[0].image


def product_summary(product: models.Product) -> schemas.ProductSummary:
    return schemas.ProductSummary(
        id=product.id,
        slug=product.slug,
        name=product.name,
        subtitle=product.subtitle,
        price_from=product.price_from,
        pricing_status=product.pricing_status,
        purchasable=product.purchasable,
        status=product.status,
        sort_order=product.sort_order,
        category_slug=product.category.slug,
        category_name=product.category.name,
        aspect_ratio=product.category.aspect_ratio,
        primary_image=image_out(_primary_image(product)),
    )


def cross_link_out(partner: models.Product | None) -> schemas.CrossLinkOut | None:
    """The paired piece, if it is itself published.

    A pairing that points at an unpublished piece is dropped rather than
    rendered, so the cross reference never offers a link that would 404.
    """
    if partner is None or not partner.is_publishable:
        return None
    return schemas.CrossLinkOut(
        slug=partner.slug,
        name=partner.name,
        subtitle=partner.subtitle,
        category_slug=partner.category.slug,
        category_name=partner.category.name,
    )


def product_detail(
    product: models.Product,
    *,
    partner: models.Product | None = None,
) -> schemas.ProductDetail:
    summary = product_summary(product)
    return schemas.ProductDetail(
        **summary.model_dump(),
        base_description=product.base_description,
        base=product.base,
        dimensions=product.dimensions,
        lead_time_weeks=product.lead_time_weeks,
        bespoke_box_type=product.bespoke_box_type,
        cross_link_slug=product.cross_link_slug,
        cross_link=cross_link_out(partner),
        spec_sheet=product.spec_sheet,
        care_guide=product.care_guide,
        images=[
            schemas.ProductImageOut(
                id=link.id,
                role=link.role,
                sort_order=link.sort_order,
                image=image_out(link.image),
            )
            for link in product.images
        ],
        materials=[
            schemas.ProductMaterialOut(
                id=link.id,
                is_default=link.is_default,
                sort_order=link.sort_order,
                material=material_out(link.material),
            )
            for link in product.materials
        ],
    )


def category_out(
    category: models.Category,
    *,
    product_count: int = 0,
    cover: models.Image | None = None,
) -> schemas.CategoryOut:
    return schemas.CategoryOut(
        id=category.id,
        slug=category.slug,
        name=category.name,
        aspect_ratio=category.aspect_ratio,
        sort_order=category.sort_order,
        status=category.status,
        intro_copy=category.intro_copy,
        bespoke_prompt=category.bespoke_prompt,
        product_count=product_count,
        cover_image=image_out(cover),
    )
