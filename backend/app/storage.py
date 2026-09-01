"""Object storage for photography, Cloudflare R2.

Why this exists at all. Photography used to live in Postgres as `bytea`, which
was a reasonable call at catalogue scale and is documented as such on
`models.Image`. It does not survive the free tier: Neon allows 0.5 GB of
storage and 5 GB of egress a month, and at a couple of megabytes a photograph
that is roughly two and a half thousand image views before the allowance is
gone. R2 gives 10 GB and charges nothing for egress, with no twelve month
expiry, so the binaries move there and Postgres keeps only the metadata.

R2 speaks the S3 API, so this is boto3 with a different endpoint. Nothing here
is Cloudflare specific beyond the endpoint URL, and pointing `R2_*` at S3 or
Backblaze would work unchanged.

The whole module is optional. `get_storage()` returns None when the
credentials are absent, and every caller treats that as "keep the bytes in the
database", which is what the test suite and a fresh clone do. That is
deliberate: the code path that runs in CI is the one that needs no network.
"""

from __future__ import annotations

import logging
import mimetypes
from functools import lru_cache
from typing import Protocol
from uuid import uuid4

from .config import Settings, get_settings

logger = logging.getLogger(__name__)

# Extension chosen from the declared MIME type rather than from the uploaded
# filename, which is attacker controlled and frequently just wrong.
_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class StorageError(RuntimeError):
    """Raised when the bucket rejects or drops an operation."""


class Storage(Protocol):  # pragma: no cover - structural typing only
    def put(self, data: bytes, mime_type: str) -> str: ...
    def head(self, key: str, expected_size: int | None = None) -> int: ...
    def delete(self, key: str) -> None: ...
    def public_url(self, key: str) -> str: ...


class R2Storage:
    def __init__(self, settings: Settings) -> None:
        import boto3
        from botocore.config import Config

        self._bucket = settings.r2_bucket
        self._public_base = settings.r2_public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            # R2 ignores the region but the S3 client insists on one, and it
            # signs with whatever it is given, so the value has to match what
            # R2 expects rather than being left to the environment.
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def put(self, data: bytes, mime_type: str) -> str:
        """Store bytes under a fresh key and return that key.

        The key is a UUID, not the original filename. Two photographs called
        `detail.jpg` are ordinary in a catalogue, and a name based key would
        have the second silently replace the first.
        """
        extension = _EXTENSIONS.get(mime_type) or mimetypes.guess_extension(mime_type) or ""
        key = f"images/{uuid4().hex}{extension}"
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=mime_type,
                # Matches the header the API already sets on /api/images/{id}.
                # Safe for the same reason it is safe there: a key is never
                # reused, so a replacement upload is a new URL.
                CacheControl="public, max-age=31536000, immutable",
            )
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller as 502
            raise StorageError(f"Could not store the image: {exc}") from exc
        return key

    def head(self, key: str, expected_size: int | None = None) -> int:
        """Confirm an object is really there, and return its size.

        Used by the migration before it clears `images.data`. A successful
        `put_object` is good evidence the bytes arrived, but it is not proof
        they can be read back, and the migration is about to destroy the only
        other copy. Cheap insurance for an irreplaceable photograph.
        """
        try:
            response = self._client.head_object(Bucket=self._bucket, Key=key)
        except Exception as exc:  # noqa: BLE001
            raise StorageError(f"Could not read back {key}: {exc}") from exc

        size = int(response.get("ContentLength", 0))
        if expected_size is not None and size != expected_size:
            raise StorageError(
                f"{key} is {size} bytes in the bucket, expected {expected_size}"
            )
        return size

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except Exception as exc:  # noqa: BLE001
            # Deliberately not fatal. The database row is the record of what
            # exists; an orphaned object costs a fraction of a penny, whereas
            # refusing the delete would leave the console unable to remove a
            # photograph because of a transient network fault.
            logger.warning("Could not delete %s from the bucket: %s", key, exc)

    def public_url(self, key: str) -> str:
        return f"{self._public_base}/{key}"


@lru_cache
def get_storage() -> Storage | None:
    """The configured bucket, or None when photography stays in Postgres."""
    settings = get_settings()
    if not settings.storage_configured:
        return None
    return R2Storage(settings)
