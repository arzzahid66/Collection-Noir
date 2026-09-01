"""The object storage path, exercised through real boto3 calls.

moto stands up an in-process S3, so `R2Storage` is tested as written rather
than against a stub that agrees with whatever the code does. R2 is S3
compatible, which is the entire reason boto3 is used for it, so this covers
the same calls production makes.

What matters here is not that boto3 works. It is the decisions layered on top
of it: that a key is never reused, that `head` refuses a truncated object, and
that the whole module stays inert when no bucket is configured.
"""

from __future__ import annotations

import os

import pytest

boto3 = pytest.importorskip("boto3")
moto = pytest.importorskip("moto")

from app import storage as storage_module  # noqa: E402
from app.config import Settings  # noqa: E402
from app.storage import R2Storage, StorageError  # noqa: E402

BUCKET = "collection-noir-test"


@pytest.fixture
def bucket():
    """An in-process S3 bucket, with credentials that cannot reach the network."""
    with moto.mock_aws():
        os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client


@pytest.fixture
def store(bucket, monkeypatch):
    settings = Settings(
        r2_account_id="test-account",
        r2_access_key_id="test-key",
        r2_secret_access_key="test-secret",
        r2_bucket=BUCKET,
        r2_public_base_url="https://images.collectionnoir.com",
    )
    store = R2Storage(settings)
    # Point the client at moto rather than at the real Cloudflare endpoint.
    store._client = bucket
    return store


def test_a_photograph_round_trips(store):
    key = store.put(b"jpeg-bytes", "image/jpeg")
    assert key.startswith("images/")
    assert key.endswith(".jpg")
    assert store.head(key, expected_size=len(b"jpeg-bytes")) == 10


def test_the_key_is_unique_per_upload(store):
    """Two photographs called detail.jpg is ordinary in a catalogue.

    A key derived from the filename would have the second silently replace the
    first, which loses a photograph and gives no sign that it happened.
    """
    first = store.put(b"one", "image/jpeg")
    second = store.put(b"two", "image/jpeg")
    assert first != second
    assert store.head(first) == 3
    assert store.head(second) == 3


@pytest.mark.parametrize(
    ("mime", "suffix"),
    [("image/jpeg", ".jpg"), ("image/png", ".png"), ("image/webp", ".webp")],
)
def test_the_extension_follows_the_mime_type_not_the_filename(store, mime, suffix):
    assert store.put(b"x", mime).endswith(suffix)


def test_the_content_type_is_preserved(store, bucket):
    key = store.put(b"x", "image/webp")
    head = bucket.head_object(Bucket=BUCKET, Key=key)
    assert head["ContentType"] == "image/webp"


def test_objects_carry_the_immutable_cache_header(store, bucket):
    """Matches what /api/images/{id} sets, and is safe for the same reason.

    A key is never reused, so a replacement upload is a new URL and a year long
    cache can never serve a stale photograph.
    """
    key = store.put(b"x", "image/jpeg")
    head = bucket.head_object(Bucket=BUCKET, Key=key)
    assert head["CacheControl"] == "public, max-age=31536000, immutable"


def test_head_rejects_an_object_of_the_wrong_size(store):
    """The migration calls this before deleting the only other copy.

    If a truncated upload passed verification, the migration would clear
    `images.data` and the photograph would be gone.
    """
    key = store.put(b"12345", "image/jpeg")
    with pytest.raises(StorageError, match="expected 99"):
        store.head(key, expected_size=99)


def test_head_on_a_missing_object_raises(store):
    with pytest.raises(StorageError, match="Could not read back"):
        store.head("images/never-uploaded.jpg")


def test_delete_removes_the_object(store):
    key = store.put(b"x", "image/jpeg")
    store.delete(key)
    with pytest.raises(StorageError):
        store.head(key)


def test_delete_of_a_missing_object_is_not_fatal(store):
    """The database row is the record of what exists.

    Refusing a delete because the bucket hiccuped would leave the console
    unable to remove a photograph. An orphaned object is the cheaper failure.
    """
    store.delete("images/never-uploaded.jpg")


def test_public_url_joins_without_a_double_slash():
    settings = Settings(
        r2_account_id="a",
        r2_access_key_id="b",
        r2_secret_access_key="c",
        r2_bucket=BUCKET,
        # Trailing slash on purpose: it is the obvious thing to paste in.
        r2_public_base_url="https://images.collectionnoir.com/",
    )
    with moto.mock_aws():
        store = R2Storage(settings)
    assert store.public_url("images/x.jpg") == "https://images.collectionnoir.com/images/x.jpg"


def test_the_endpoint_is_derived_from_the_account():
    settings = Settings(r2_account_id="abc123")
    assert settings.r2_endpoint_url == "https://abc123.r2.cloudflarestorage.com"


# ------------------------------------------------------- optional by default


def test_storage_is_not_configured_without_credentials():
    assert Settings().storage_configured is False


def test_a_partial_credential_set_does_not_count_as_configured():
    """Half a credential set is a misconfiguration, not a working bucket.

    Treating it as configured would send uploads at a client that cannot
    authenticate, and the first sign of it would be a failed upload rather
    than a clear "not configured".
    """
    settings = Settings(r2_account_id="a", r2_access_key_id="b", r2_bucket=BUCKET)
    assert settings.storage_configured is False


def test_get_storage_returns_none_when_unconfigured(monkeypatch):
    storage_module.get_storage.cache_clear()
    monkeypatch.setattr(storage_module, "get_settings", lambda: Settings())
    try:
        assert storage_module.get_storage() is None
    finally:
        storage_module.get_storage.cache_clear()
