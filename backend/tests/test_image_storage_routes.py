"""How the image routes behave once photography lives in a bucket.

The promise made on `models.Image` is that the move is invisible to the
frontend, because the contract was always "whatever `url` says". These tests
hold that promise to account, and cover the half migrated state explicitly,
since a catalogue is migrated a photograph at a time and both kinds of row
exist at once while that happens.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app import serializers
from app.config import Settings
from app.models import Image
from app.serializers import image_url

from .conftest import jpeg


class FakeStorage:
    """Enough of the Storage protocol for the routes, with no network."""

    def __init__(self, public_base: str = "https://images.collectionnoir.com") -> None:
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self._public_base = public_base
        self._counter = 0

    def put(self, data: bytes, mime_type: str) -> str:
        self._counter += 1
        key = f"images/fake{self._counter}.jpg"
        self.objects[key] = data
        return key

    def head(self, key: str, expected_size: int | None = None) -> int:
        return len(self.objects[key])

    def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.objects.pop(key, None)

    def public_url(self, key: str) -> str:
        return f"{self._public_base}/{key}"


@pytest.fixture
def fake_storage(monkeypatch):
    store = FakeStorage()
    monkeypatch.setattr("app.routers.images.get_storage", lambda: store)
    return store


# --------------------------------------------------------------- the URL


def test_a_database_backed_image_keeps_the_api_url(db):
    """Rows uploaded before the bucket existed must not change behaviour."""
    image = Image(filename="a.jpg", mime_type="image/jpeg", data=b"x", byte_size=1)
    db.add(image)
    db.commit()
    try:
        assert image_url(image) == f"/api/images/{image.id}"
    finally:
        db.delete(image)
        db.commit()


def test_a_bucket_backed_image_points_straight_at_the_bucket(db, monkeypatch):
    """The whole point of the exercise.

    The bytes go from Cloudflare to the browser, touching neither the API host
    nor Neon, so neither the compute allowance nor the egress allowance is
    spent on serving a photograph.
    """
    monkeypatch.setattr(
        serializers,
        "get_settings",
        lambda: Settings(r2_public_base_url="https://images.collectionnoir.com"),
    )
    image = Image(
        filename="a.jpg",
        mime_type="image/jpeg",
        data=None,
        storage_key="images/abc.jpg",
        byte_size=1,
    )
    db.add(image)
    db.commit()
    try:
        assert image_url(image) == "https://images.collectionnoir.com/images/abc.jpg"
    finally:
        db.delete(image)
        db.commit()


def test_a_bucket_backed_image_falls_back_to_the_api_without_a_public_host(db, monkeypatch):
    """A bucket with no public hostname is still usable: the API redirects."""
    monkeypatch.setattr(serializers, "get_settings", lambda: Settings(r2_public_base_url=""))
    image = Image(
        filename="a.jpg",
        mime_type="image/jpeg",
        data=None,
        storage_key="images/abc.jpg",
        byte_size=1,
    )
    db.add(image)
    db.commit()
    try:
        assert image_url(image) == f"/api/images/{image.id}"
    finally:
        db.delete(image)
        db.commit()


# ------------------------------------------------------------- the routes


def test_an_upload_goes_to_the_bucket_not_the_database(admin, fake_storage, db):
    data = jpeg(1200, 800)
    response = admin.post(
        "/api/admin/images",
        files={"file": ("piece.jpg", data, "image/jpeg")},
    )
    assert response.status_code == 201
    body = response.json()

    stored = db.get(Image, body["id"])
    db.refresh(stored)
    try:
        assert stored.storage_key in fake_storage.objects
        # The binary is in the bucket and nowhere else. If this regresses the
        # storage allowance is spent twice over for no benefit.
        assert stored.data is None
        assert stored.byte_size == len(data)
        # Dimensions are still read at upload, for the console ratio check.
        assert (stored.width, stored.height) == (1200, 800)
    finally:
        db.delete(stored)
        db.commit()


def test_an_upload_stays_in_the_database_without_a_bucket(admin, db):
    """No credentials means no behaviour change. This is what CI runs."""
    data = jpeg(600, 400)
    response = admin.post(
        "/api/admin/images", files={"file": ("piece.jpg", data, "image/jpeg")}
    )
    assert response.status_code == 201

    stored = db.get(Image, response.json()["id"])
    db.refresh(stored)
    try:
        assert stored.storage_key is None
        assert stored.data == data
    finally:
        db.delete(stored)
        db.commit()


def test_a_bucket_failure_is_reported_not_hidden(admin, monkeypatch):
    """Deliberately not a silent fallback into the database.

    A configured bucket that is failing is an operational fault. Quietly
    writing megabytes into Neon instead would hide it until the storage
    allowance ran out, which is a far worse way to find out.
    """
    from app.storage import StorageError

    class Failing(FakeStorage):
        def put(self, data, mime_type):
            raise StorageError("bucket unreachable")

    monkeypatch.setattr("app.routers.images.get_storage", lambda: Failing())

    response = admin.post(
        "/api/admin/images", files={"file": ("p.jpg", jpeg(10, 10), "image/jpeg")}
    )
    assert response.status_code == 502
    assert "bucket unreachable" in response.json()["detail"]


def test_the_api_url_still_serves_a_database_backed_image(client, db):
    """Every URL ever handed out stays valid."""
    data = jpeg(40, 40)
    image = Image(
        filename="legacy.jpg", mime_type="image/jpeg", data=data, byte_size=len(data)
    )
    db.add(image)
    db.commit()
    try:
        response = client.get(f"/api/images/{image.id}")
        assert response.status_code == 200
        assert response.content == data
        assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
        assert response.headers["etag"]
    finally:
        db.delete(image)
        db.commit()


def test_the_api_url_redirects_a_bucket_backed_image(client, db, fake_storage):
    image = Image(
        filename="new.jpg",
        mime_type="image/jpeg",
        data=None,
        storage_key="images/abc.jpg",
        byte_size=3,
    )
    db.add(image)
    db.commit()
    try:
        response = client.get(f"/api/images/{image.id}", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == (
            "https://images.collectionnoir.com/images/abc.jpg"
        )
    finally:
        db.delete(image)
        db.commit()


def test_a_bucket_backed_image_reports_unavailable_rather_than_missing(client, db):
    """503, not 404.

    404 would say the photograph does not exist, which is false and would send
    someone hunting for a record that was never deleted.
    """
    image = Image(
        filename="new.jpg",
        mime_type="image/jpeg",
        data=None,
        storage_key="images/abc.jpg",
        byte_size=3,
    )
    db.add(image)
    db.commit()
    try:
        response = client.get(f"/api/images/{image.id}", follow_redirects=False)
        assert response.status_code == 503
    finally:
        db.delete(image)
        db.commit()


def test_deleting_an_image_removes_the_object_too(admin, fake_storage, db):
    data = jpeg(30, 30)
    created = admin.post(
        "/api/admin/images", files={"file": ("p.jpg", data, "image/jpeg")}
    ).json()
    key = db.get(Image, created["id"]).storage_key

    response = admin.delete(f"/api/admin/images/{created['id']}")

    assert response.status_code == 204
    assert key in fake_storage.deleted
    assert db.get(Image, created["id"]) is None


def test_a_half_migrated_catalogue_serves_both_kinds(db, monkeypatch):
    """Each photograph is served from wherever it currently is.

    This is what makes the migration a background job rather than a cutover.
    """
    monkeypatch.setattr(
        serializers,
        "get_settings",
        lambda: Settings(r2_public_base_url="https://images.collectionnoir.com"),
    )
    legacy = Image(filename="a.jpg", mime_type="image/jpeg", data=b"x", byte_size=1)
    migrated = Image(
        filename="b.jpg",
        mime_type="image/jpeg",
        data=None,
        storage_key="images/b.jpg",
        byte_size=1,
    )
    db.add_all([legacy, migrated])
    db.commit()
    try:
        assert image_url(legacy) == f"/api/images/{legacy.id}"
        assert image_url(migrated) == "https://images.collectionnoir.com/images/b.jpg"
    finally:
        db.delete(legacy)
        db.delete(migrated)
        db.commit()
