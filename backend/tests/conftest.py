"""Test fixtures.

Every test runs against a throwaway SQLite database seeded from the real
`app.seed` module, so the suite asserts against the same catalogue the site is
built from rather than against a hand-written fixture that could drift away from
section 08.

The database URL and the administrator credential are set before `app` is
imported, because `app.db` builds its engine at import time from settings.
"""

from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="cn-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP.as_posix()}/test.db"
os.environ["ADMIN_EMAIL"] = "tests@collectionnoir.com"
os.environ["ADMIN_PASSWORD"] = "tests-only-password"
os.environ["SESSION_SECRET"] = "tests-only-secret"
os.environ["COOKIE_SECURE"] = "0"

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image as PILImage  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app import seed  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Image, Product, ProductImage  # noqa: E402

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


def jpeg(width: int, height: int, shade: tuple[int, int, int] = (196, 170, 152)) -> bytes:
    buffer = io.BytesIO()
    PILImage.new("RGB", (width, height), shade).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    """Create the schema and seed the launch catalogue once for the session."""
    Base.metadata.create_all(bind=engine)
    seed.main()


@pytest.fixture(autouse=True)
def _reset_rate_limit() -> None:
    """Clear the enquiry rate limiter before every test.

    The limiter is a module level singleton holding counts per address, and
    every test client reports the same address. Without this, the sixth test
    to post an enquiry fails with 429 because of what the previous five did,
    which makes the suite order dependent and the failure baffling.
    """
    from app.ratelimit import enquiry_limiter

    enquiry_limiter.reset()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def admin(client: TestClient) -> TestClient:
    """A client carrying a valid administrator session."""
    response = client.post(
        "/api/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def photographed(db):
    """Attach a photograph to Roma, then remove it again afterwards.

    Publishing is gated on having at least one image, so any test that needs a
    piece to reach the public site has to supply one. Cleaning up keeps the
    default state of the catalogue "priced but unphotographed", which is what
    the handoff actually ships.
    """
    product = db.scalar(select(Product).where(Product.slug == "roma"))
    data = jpeg(3000, 2000)
    image = Image(
        filename="roma.jpg",
        mime_type="image/jpeg",
        data=data,
        byte_size=len(data),
        width=3000,
        height=2000,
        alt_text="Roma, Nero Marquina",
    )
    db.add(image)
    db.flush()
    link = ProductImage(
        product_id=product.id, image_id=image.id, role="primary", sort_order=0
    )
    db.add(link)
    db.commit()

    yield {"product_id": product.id, "image_id": image.id, "data": data}

    db.delete(link)
    db.delete(image)
    db.commit()
