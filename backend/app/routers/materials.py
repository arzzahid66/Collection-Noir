from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db
from ..serializers import material_out

router = APIRouter(tags=["materials"])


def _query():
    return (
        select(models.Material)
        .options(joinedload(models.Material.image))
        .order_by(models.Material.sort_order, models.Material.name)
    )


@router.get("/api/materials", response_model=list[schemas.MaterialOut])
def list_materials(
    family: str | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.MaterialOut]:
    stmt = _query()
    if family:
        stmt = stmt.where(models.Material.family == family)
    return [material_out(m) for m in db.scalars(stmt).unique().all()]


@router.get("/api/materials/{slug}", response_model=schemas.MaterialOut)
def get_material(slug: str, db: Session = Depends(get_db)) -> schemas.MaterialOut:
    material = db.scalars(_query().where(models.Material.slug == slug)).unique().one_or_none()
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    return material_out(material)


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.post(
    "/api/admin/materials",
    response_model=schemas.MaterialOut,
    status_code=status.HTTP_201_CREATED,
)
def create_material(
    payload: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.MaterialOut:
    if db.scalar(select(models.Material).where(models.Material.slug == payload.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A material already uses that slug")
    material = models.Material(**payload.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return material_out(material)


@router.patch("/api/admin/materials/{material_id}", response_model=schemas.MaterialOut)
def update_material(
    material_id: int,
    payload: schemas.MaterialUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.MaterialOut:
    material = db.get(models.Material, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")

    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates:
        clash = db.scalar(
            select(models.Material).where(
                models.Material.slug == updates["slug"],
                models.Material.id != material_id,
            )
        )
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "A material already uses that slug")

    for field, value in updates.items():
        setattr(material, field, value)
    db.commit()
    db.refresh(material)
    return material_out(material)


@router.delete("/api/admin/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    material = db.get(models.Material, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Material not found")
    db.delete(material)
    db.commit()
