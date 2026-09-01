"""Placeholder photography for local development only.

Section 07 point 5 asks for the category grid to be tested against real supplied
photography, and is explicit that placeholders are not a substitute. This module
does not pretend otherwise. What it does is let the grid be exercised before any
photography exists, at the three shapes that matter:

  - an image matching its category ratio exactly, which should sit almost edge
    to edge in the frame
  - a square dropped into a 3:2 frame, which must letterbox rather than crop
  - a square dropped into a 4:5 frame, the same

Every piece is left withheld until it has a photograph, so without this the
local site renders an empty collection and none of the grid rules can be seen.

This refuses to run if any image already exists, so it can never overwrite real
photography or add placeholders alongside it.

Run with:  python -m app.seed_demo_images
Undo with: python -m app.seed_demo_images --clear
"""

from __future__ import annotations

import io
import sys

from PIL import Image as PILImage
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .db import SessionLocal
from .models import Image, Product, ProductImage

# Warm neutrals from the palette's range, so a placeholder grid still reads as
# the right brand rather than as a wall of grey boxes.
EXACT_LANDSCAPE = (196, 170, 152)
EXACT_PORTRAIT = (217, 203, 180)
MISMATCHED_SQUARE = (156, 130, 114)
HERO = (170, 150, 134)


def _jpeg(width: int, height: int, shade: tuple[int, int, int]) -> bytes:
    buffer = io.BytesIO()
    PILImage.new("RGB", (width, height), shade).save(buffer, format="JPEG", quality=88)
    return buffer.getvalue()


def clear(db: Session) -> int:
    """Remove every image. Only ever run against a local database."""
    images = db.scalars(select(Image)).all()
    for image in images:
        db.delete(image)
    db.commit()
    return len(images)


def generate(db: Session) -> int:
    if db.scalar(select(Image).limit(1)):
        print("Images already exist. Nothing was changed.")
        print("This only ever runs against an empty image table, so it cannot")
        print("overwrite real photography. Use --clear first if you meant to.")
        return 0

    products = list(
        db.scalars(
            select(Product)
            .options(joinedload(Product.category))
            .order_by(Product.sort_order)
        ).unique()
    )

    attached = 0
    for position, product in enumerate(products):
        # A paused piece stays without photography, which is what keeps Kaia
        # off the site and makes that rule visible locally.
        if product.status != "live":
            continue

        # Every third piece gets a deliberately mismatched square, so the
        # letterbox path is exercised alongside the exact-ratio path.
        if position % 3 == 2:
            size, shade = (2000, 2000), MISMATCHED_SQUARE
        elif product.category.aspect_ratio == "3-2":
            size, shade = (3000, 2000), EXACT_LANDSCAPE
        else:
            size, shade = (1600, 2000), EXACT_PORTRAIT

        data = _jpeg(*size, shade)
        image = Image(
            filename=f"{product.slug}.jpg",
            mime_type="image/jpeg",
            data=data,
            byte_size=len(data),
            width=size[0],
            height=size[1],
            alt_text=f"{product.name}, {product.subtitle}",
        )
        db.add(image)
        db.flush()
        db.add(
            ProductImage(
                product_id=product.id,
                image_id=image.id,
                role="primary",
                sort_order=0,
            )
        )

        # The first two live pieces also carry a hero frame, so the homepage
        # hero and its crossfade can be seen.
        if attached < 2:
            hero_data = _jpeg(2400, 1200, HERO)
            hero = Image(
                filename=f"{product.slug}-hero.jpg",
                mime_type="image/jpeg",
                data=hero_data,
                byte_size=len(hero_data),
                width=2400,
                height=1200,
                alt_text="Collection Noir",
            )
            db.add(hero)
            db.flush()
            db.add(
                ProductImage(
                    product_id=product.id,
                    image_id=hero.id,
                    role="hero",
                    sort_order=attached,
                )
            )

        attached += 1

    db.commit()
    return attached


def main() -> None:
    with SessionLocal() as db:
        if "--clear" in sys.argv:
            print(f"Removed {clear(db)} images.")
            return

        attached = generate(db)
        if not attached:
            return

        publishable = [p for p in db.scalars(select(Product)).all() if p.is_publishable]
        print(f"Placeholder photography attached to {attached} pieces.")
        print(f"Publishable now: {len(publishable)}.")
        print()
        print("These are flat colour blocks, not photography. Section 07 asks")
        print("for the grid to be checked against the real supplied images")
        print("before any category page is considered finished.")


if __name__ == "__main__":
    main()
