import hashlib
import io

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import RedirectResponse
from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import current_admin
from ..db import get_db
from ..serializers import image_out
from ..storage import StorageError, get_storage

router = APIRouter(tags=["images"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 25 * 1024 * 1024  # 25MB, generous for full resolution product photography


@router.get("/api/images/{image_id}")
def get_image(image_id: int, request: Request, db: Session = Depends(get_db)) -> Response:
    """Serve an image binary.

    The image is returned exactly as it was uploaded. Nothing here crops,
    resizes or re-encodes.

    Kept as the permanent public contract even now that photography lives in a
    bucket. A row whose binary is in Postgres is served from here as it always
    was; a row that has been migrated is redirected to the bucket. So every URL
    ever handed out stays valid, and a catalogue can be migrated a photograph
    at a time with nothing breaking in between.

    Normally the frontend never reaches the redirect: `serializers.image_url`
    hands it the bucket URL directly whenever one is configured. This route
    covers a bucket with no public hostname, and any link already in the wild.
    """
    image = db.get(models.Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")

    if image.data is None:
        storage = get_storage()
        if storage is None or not image.storage_key:
            # The row says the binary is in the bucket and the bucket is not
            # reachable. A 404 would say the photograph does not exist, which
            # is wrong and would send someone hunting for a deleted record.
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "That image is held in object storage, which is not configured",
            )
        return RedirectResponse(
            storage.public_url(image.storage_key),
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    etag = f'"{hashlib.sha256(image.data).hexdigest()[:32]}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})

    return Response(
        content=image.data,
        media_type=image.mime_type,
        headers={
            "ETag": etag,
            # Long cache is safe: the URL is id-based and a replacement upload
            # creates a new id rather than mutating this one.
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{image.filename}"',
        },
    )


@router.get("/api/hero-images", response_model=list[schemas.ImageOut])
def list_hero_images(db: Session = Depends(get_db)) -> list[schemas.ImageOut]:
    """Photography for the homepage hero.

    Any image attached to a publishable piece with the role `hero` is offered,
    in the order the console sets. Held as data rather than as a filename in
    the template, so the hero can be changed without a developer touching
    template code.
    """
    stmt = (
        select(models.ProductImage)
        .where(models.ProductImage.role == "hero")
        .order_by(models.ProductImage.sort_order, models.ProductImage.id)
    )
    out: list[schemas.ImageOut] = []
    seen: set[int] = set()
    for link in db.scalars(stmt).unique().all():
        if not link.product.is_publishable or link.image_id in seen:
            continue
        seen.add(link.image_id)
        serialised = image_out(link.image)
        if serialised is not None:
            out.append(serialised)
    return out


@router.get("/api/admin/images", response_model=list[schemas.ImageOut])
def list_images(
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> list[schemas.ImageOut]:
    images = db.scalars(select(models.Image).order_by(models.Image.created_at.desc())).all()
    return [image_out(image) for image in images]


@router.post(
    "/api/admin/images",
    response_model=schemas.ImageOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ImageOut:
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Supported formats are JPEG, PNG and WebP. Received {file.content_type}.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file was empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Images must be under {MAX_BYTES // (1024 * 1024)}MB",
        )

    # Read the natural dimensions only. The admin console compares these
    # against the category target ratio so off-ratio photography is visible
    # before it reaches the grid. The bytes themselves are stored untouched.
    try:
        with PILImage.open(io.BytesIO(data)) as probe:
            width, height = probe.size
    except Exception as exc:  # noqa: BLE001 - any decode failure is a bad upload
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "That file could not be read as an image"
        ) from exc

    # Where the binary goes. With a bucket configured the bytes leave the
    # database entirely; without one they stay in `data` exactly as before,
    # which is what keeps a fresh clone and the test suite working with no
    # credentials and no network.
    storage = get_storage()
    storage_key: str | None = None
    if storage is not None:
        try:
            storage_key = storage.put(data, file.content_type)
        except StorageError as exc:
            # Deliberately not a silent fallback into the database. A bucket
            # that is configured but failing is an operational fault, and
            # quietly writing megabytes into Neon instead would hide it until
            # the storage allowance ran out.
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    image = models.Image(
        filename=file.filename or "upload",
        mime_type=file.content_type,
        data=None if storage_key else data,
        storage_key=storage_key,
        byte_size=len(data),
        width=width,
        height=height,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image_out(image)


@router.patch("/api/admin/images/{image_id}", response_model=schemas.ImageOut)
def update_image(
    image_id: int,
    payload: schemas.ImageUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> schemas.ImageOut:
    image = db.get(models.Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    if payload.alt_text is not None:
        image.alt_text = payload.alt_text
    db.commit()
    db.refresh(image)
    return image_out(image)


@router.delete("/api/admin/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(current_admin),
) -> None:
    image = db.get(models.Image, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")

    # Read the key before the row goes, and drop the object after the delete
    # commits. The other order would remove the binary and then potentially
    # fail to remove the row, leaving a record pointing at nothing. An
    # orphaned object costs a fraction of a penny; a broken row costs a
    # photograph on the site.
    storage_key = image.storage_key
    db.delete(image)
    db.commit()

    if storage_key:
        storage = get_storage()
        if storage is not None:
            storage.delete(storage_key)
