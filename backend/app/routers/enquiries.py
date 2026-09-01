import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db
from ..notify import send_enquiry_notification
from ..ratelimit import client_key, enquiry_limiter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["enquiries"])


def _notify_safely(enquiry: models.Enquiry) -> None:
    """Run the notification so that nothing it does can escape.

    `send_enquiry_notification` already swallows its own failures, so this
    looks redundant. It is not, and the test suite proves it: Starlette awaits
    background tasks inside the ASGI call, so an exception raised by one
    propagates into the server rather than being contained. Relying on the
    callee to never raise makes the guarantee depend on the discipline of
    whatever is wired up here later.

    So the boundary is defended at the boundary. The enquiry is committed
    before this runs; nothing after that point is allowed to matter.
    """
    try:
        send_enquiry_notification(enquiry)
    except Exception:  # noqa: BLE001 - deliberately total, see above
        logger.exception("Notification for enquiry #%s escaped its handler", enquiry.id)


@router.post(
    "/api/enquiries",
    response_model=schemas.EnquiryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_enquiry(
    payload: schemas.EnquiryCreate,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> models.Enquiry:
    """Record an enquiry, then tell the studio about it.

    The three public forms all arrive here: the enquiry form, the trade
    registration and the members list signup, separated by `type`.

    Order matters. The row is committed first and the notification is queued
    after, as a background task. An enquiry that is stored but not emailed is
    recoverable, because it is sitting in the console; an enquiry that failed
    because the mail provider was down is gone, and the client saw an error.
    So nothing about delivery is allowed to reach this response.
    """
    if not enquiry_limiter.allow(client_key(request)):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "That is several enquiries in a short time. Please try again shortly, "
            "or write to us directly.",
        )

    if payload.product_id is not None and db.get(models.Product, payload.product_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That piece does not exist")

    enquiry = models.Enquiry(**payload.model_dump())
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)

    background.add_task(_notify_safely, enquiry)
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
