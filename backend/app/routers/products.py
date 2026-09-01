from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db
from ..serializers import product_detail, product_summary

router = APIRouter(tags=["products"])


def _base_query():
    return select(models.Product).options(
        joinedload(models.Product.category),
        selectinload(models.Product.images).selectinload(models.ProductImage.image),
        selectinload(models.Product.materials).selectinload(models.ProductMaterial.material),
    )


@router.get("/api/products", response_model=list[schemas.ProductSummary])
def list_products(
    category: str | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.ProductSummary]:
    """Public product list.

    Only publishable pieces are returned: live status, at least one
    photograph, and a confirmed price. A piece missing any of these is
    withheld from the site entirely rather than shown without a price.
    """
    stmt = _base_query().order_by(models.Product.sort_order, models.Product.name)
    if category:
        stmt = stmt.join(models.Category).where(models.Category.slug == category)
    products = db.scalars(stmt).unique().all()
    return [product_summary(p) for p in products if p.is_publishable]


@router.get(
    "/api/products/{category_slug}/{product_slug}",
    response_model=schemas.ProductDetail,
)
def get_product(
    category_slug: str,
    product_slug: str,
    db: Session = Depends(get_db),
) -> schemas.ProductDetail:
    stmt = (
        _base_query()
        .join(models.Category)
        .where(
            models.Category.slug == category_slug,
            models.Product.slug == product_slug,
        )
    )
    product = db.scalars(stmt).unique().one_or_none()
    if product is None or not product.is_publishable:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    return product_detail(product, partner=_partner(db, product))


def _partner(db: Session, product: models.Product) -> models.Product | None:
    """Resolve the paired piece behind `cross_link_slug`.

    The pairing is stored as a slug rather than a foreign key because it is
    editorial and the partner may not exist yet. Slugs are scoped to a
    category, so a slug on its own can match more than one row: `oria` is both
    a side table and a plinth. The piece itself is excluded from the match,
    which is what picks the plinth when the side table asks and the reverse.
    """
    if not product.cross_link_slug:
        return None
    stmt = (
        _base_query()
        .where(
            models.Product.slug == product.cross_link_slug,
            models.Product.id != product.id,
        )
        .limit(1)
    )
    return db.scalars(stmt).unique().one_or_none()


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.get("/api/admin/products", response_model=list[schemas.ProductDetail])
def admin_list_products(
    category: str | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> list[schemas.ProductDetail]:
    stmt = _base_query().order_by(models.Product.sort_order, models.Product.name)
    if category:
        stmt = stmt.join(models.Category).where(models.Category.slug == category)
    return [product_detail(p) for p in db.scalars(stmt).unique().all()]


@router.get("/api/admin/products/{product_id}", response_model=schemas.ProductDetail)
def admin_get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    product = db.scalars(_base_query().where(models.Product.id == product_id)).unique().one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    return product_detail(product)


def _assert_slug_free(db: Session, category_id: int, slug: str, exclude_id: int | None = None) -> None:
    stmt = select(models.Product).where(
        models.Product.category_id == category_id,
        models.Product.slug == slug,
    )
    if exclude_id is not None:
        stmt = stmt.where(models.Product.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Another piece in this category already uses that slug",
        )


@router.post(
    "/api/admin/products",
    response_model=schemas.ProductDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    if db.get(models.Category, payload.category_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That category does not exist")
    _assert_slug_free(db, payload.category_id, payload.slug)

    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    product = db.scalars(_base_query().where(models.Product.id == product.id)).unique().one()
    return product_detail(product)


@router.patch("/api/admin/products/{product_id}", response_model=schemas.ProductDetail)
def update_product(
    product_id: int,
    payload: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")

    updates = payload.model_dump(exclude_unset=True)
    target_category = updates.get("category_id", product.category_id)
    target_slug = updates.get("slug", product.slug)
    if "slug" in updates or "category_id" in updates:
        if db.get(models.Category, target_category) is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That category does not exist")
        _assert_slug_free(db, target_category, target_slug, exclude_id=product_id)

    for field, value in updates.items():
        setattr(product, field, value)
    db.commit()

    product = db.scalars(_base_query().where(models.Product.id == product_id)).unique().one()
    return product_detail(product)


@router.delete("/api/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    db.delete(product)
    db.commit()


@router.post("/api/admin/products/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_products(
    payload: schemas.ReorderRequest,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    for position, product_id in enumerate(payload.ids):
        product = db.get(models.Product, product_id)
        if product is not None:
            product.sort_order = position
    db.commit()


# --- Image attachment -------------------------------------------------------


@router.post(
    "/api/admin/products/{product_id}/images",
    response_model=schemas.ProductDetail,
    status_code=status.HTTP_201_CREATED,
)
def attach_image(
    product_id: int,
    payload: schemas.ProductImageAttach,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    if db.get(models.Image, payload.image_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That image does not exist")

    # Only one image carries the primary role, since it is what the category
    # grid renders.
    if payload.role == "primary":
        for link in product.images:
            if link.role == "primary":
                link.role = "hero"

    db.add(
        models.ProductImage(
            product_id=product_id,
            image_id=payload.image_id,
            role=payload.role,
            sort_order=payload.sort_order,
        )
    )
    db.commit()
    product = db.scalars(_base_query().where(models.Product.id == product_id)).unique().one()
    return product_detail(product)


@router.patch(
    "/api/admin/products/{product_id}/images/{link_id}",
    response_model=schemas.ProductDetail,
)
def update_product_image(
    product_id: int,
    link_id: int,
    payload: schemas.ProductImageAttach,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    link = db.get(models.ProductImage, link_id)
    if link is None or link.product_id != product_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image is not attached to this piece")

    if payload.role == "primary":
        for other in link.product.images:
            if other.id != link_id and other.role == "primary":
                other.role = "hero"

    link.role = payload.role
    link.sort_order = payload.sort_order
    link.image_id = payload.image_id
    db.commit()
    product = db.scalars(_base_query().where(models.Product.id == product_id)).unique().one()
    return product_detail(product)


@router.delete(
    "/api/admin/products/{product_id}/images/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_image(
    product_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    link = db.get(models.ProductImage, link_id)
    if link is None or link.product_id != product_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image is not attached to this piece")
    db.delete(link)
    db.commit()


# --- Material attachment ----------------------------------------------------


@router.post(
    "/api/admin/products/{product_id}/materials",
    response_model=schemas.ProductDetail,
    status_code=status.HTTP_201_CREATED,
)
def attach_material(
    product_id: int,
    payload: schemas.ProductMaterialAttach,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ProductDetail:
    product = db.get(models.Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    if db.get(models.Material, payload.material_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That material does not exist")

    existing = db.scalar(
        select(models.ProductMaterial).where(
            models.ProductMaterial.product_id == product_id,
            models.ProductMaterial.material_id == payload.material_id,
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "That material is already listed")

    if payload.is_default:
        for link in product.materials:
            link.is_default = False

    db.add(models.ProductMaterial(product_id=product_id, **payload.model_dump()))
    db.commit()
    product = db.scalars(_base_query().where(models.Product.id == product_id)).unique().one()
    return product_detail(product)


@router.delete(
    "/api/admin/products/{product_id}/materials/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_material(
    product_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    link = db.get(models.ProductMaterial, link_id)
    if link is None or link.product_id != product_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material is not listed on this piece")
    db.delete(link)
    db.commit()
