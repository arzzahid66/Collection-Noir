from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db
from ..serializers import _primary_image, category_out

router = APIRouter(tags=["categories"])


def _load_all(db: Session) -> list[models.Category]:
    stmt = (
        select(models.Category)
        .options(
            selectinload(models.Category.products)
            .selectinload(models.Product.images)
            .selectinload(models.ProductImage.image)
        )
        .order_by(models.Category.sort_order, models.Category.name)
    )
    return list(db.scalars(stmt).unique().all())


def _publishable(category: models.Category) -> list[models.Product]:
    return [p for p in category.products if p.is_publishable]


@router.get("/api/categories", response_model=list[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[schemas.CategoryOut]:
    """Public category list.

    Hidden categories are withheld. Coming-soon categories are returned so the
    overview grid can show them with a label, but they carry no products.
    """
    out: list[schemas.CategoryOut] = []
    for category in _load_all(db):
        if category.status == "hidden":
            continue
        products = _publishable(category)
        cover = _primary_image(products[0]) if products else None
        out.append(category_out(category, product_count=len(products), cover=cover))
    return out


@router.get("/api/categories/{slug}", response_model=schemas.CategoryOut)
def get_category(slug: str, db: Session = Depends(get_db)) -> schemas.CategoryOut:
    stmt = (
        select(models.Category)
        .where(models.Category.slug == slug)
        .options(
            selectinload(models.Category.products)
            .selectinload(models.Product.images)
            .selectinload(models.ProductImage.image)
        )
    )
    category = db.scalars(stmt).unique().one_or_none()
    if category is None or category.status == "hidden":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    products = _publishable(category)
    cover = _primary_image(products[0]) if products else None
    return category_out(category, product_count=len(products), cover=cover)


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.get("/api/admin/categories", response_model=list[schemas.CategoryOut])
def admin_list_categories(
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> list[schemas.CategoryOut]:
    return [
        category_out(
            category,
            product_count=len(category.products),
            cover=_primary_image(category.products[0]) if category.products else None,
        )
        for category in _load_all(db)
    ]


@router.post(
    "/api/admin/categories",
    response_model=schemas.CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.CategoryOut:
    if db.scalar(select(models.Category).where(models.Category.slug == payload.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A category already uses that slug")
    category = models.Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category_out(category)


@router.patch("/api/admin/categories/{category_id}", response_model=schemas.CategoryOut)
def update_category(
    category_id: int,
    payload: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.CategoryOut:
    category = db.get(models.Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates:
        clash = db.scalar(
            select(models.Category).where(
                models.Category.slug == updates["slug"],
                models.Category.id != category_id,
            )
        )
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "A category already uses that slug")

    for field, value in updates.items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category_out(category, product_count=len(category.products))


@router.delete("/api/admin/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    category = db.get(models.Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if category.products:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Move or remove the pieces in this category first",
        )
    db.delete(category)
    db.commit()


@router.post("/api/admin/categories/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_categories(
    payload: schemas.ReorderRequest,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    for position, category_id in enumerate(payload.ids):
        category = db.get(models.Category, category_id)
        if category is not None:
            category.sort_order = position
    db.commit()
