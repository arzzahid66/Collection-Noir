from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db

router = APIRouter(tags=["enquiries"])


@router.post(
    "/api/enquiries",
    response_model=schemas.EnquiryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_enquiry(
    payload: schemas.EnquiryCreate,
    db: Session = Depends(get_db),
) -> models.Enquiry:
    if payload.product_id is not None and db.get(models.Product, payload.product_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That piece does not exist")

    enquiry = models.Enquiry(**payload.model_dump(), )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry


@router.get("/api/admin/enquiries", response_model=list[schemas.EnquiryOut])
def list_enquiries(
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> list[models.Enquiry]:
    stmt = select(models.Enquiry).order_by(models.Enquiry.created_at.desc())
    return list(db.scalars(stmt).all())


@router.patch("/api/admin/enquiries/{enquiry_id}", response_model=schemas.EnquiryOut)
def mark_handled(
    enquiry_id: int,
    handled: bool = True,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> models.Enquiry:
    enquiry = db.get(models.Enquiry, enquiry_id)
    if enquiry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Enquiry not found")
    enquiry.handled = handled
    db.commit()
    db.refresh(enquiry)
    return enquiry
