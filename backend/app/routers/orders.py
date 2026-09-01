"""Ordering stub.

Reserved for a future collection. No piece in the launch catalogue is
purchasable, so nothing reaches this router in normal use.

There is deliberately no cart, no basket, no checkout and no payment provider  copy-lint-ok
anywhere in this codebase. When the future collection is ready, this module is
where that work resumes, and it will need the full distance-selling set
alongside it: pre-contract information, confirmed delivery terms, and the
cancellation position for made-to-order goods.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..schemas import ORMModel

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderIntent(ORMModel):
    product_id: int
    quantity: int = 1


@router.post("", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def create_order(payload: OrderIntent, db: Session = Depends(get_db)) -> None:
    product = db.get(models.Product, payload.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piece not found")
    if not product.purchasable:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This piece is made to order. Please enquire.",
        )
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        "Ordering opens with the next collection. Please enquire in the meantime.",
    )
