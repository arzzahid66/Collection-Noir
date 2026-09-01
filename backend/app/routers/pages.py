from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db

router = APIRouter(tags=["pages"])


@router.get("/api/pages", response_model=list[schemas.PageOut])
def list_pages(db: Session = Depends(get_db)) -> list[models.Page]:
    return list(db.scalars(select(models.Page).order_by(models.Page.slug)).all())


@router.get("/api/pages/{slug}", response_model=schemas.PageOut)
def get_page(slug: str, db: Session = Depends(get_db)) -> models.Page:
    page = db.scalar(select(models.Page).where(models.Page.slug == slug))
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found")
    return page


@router.put("/api/admin/pages/{slug}", response_model=schemas.PageOut)
def upsert_page(
    slug: str,
    payload: schemas.PageUpsert,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> models.Page:
    """Create or replace a page body.

    Copy lives in the database so wording changes need no redeploy.
    """
    page = db.scalar(select(models.Page).where(models.Page.slug == slug))
    if page is None:
        page = models.Page(slug=slug, title=payload.title, body=payload.body)
        db.add(page)
    else:
        page.title = payload.title
        page.body = payload.body
    db.commit()
    db.refresh(page)
    return page
