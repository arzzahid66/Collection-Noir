"""Move photograph binaries from Postgres into the bucket.

Run once, after `R2_*` is configured and `alembic upgrade head` has added
`images.storage_key`:

    python -m app.migrate_images --dry-run
    python -m app.migrate_images

Why this is a script and not part of the Alembic revision: it streams the whole
photographic catalogue over the network, one row at a time, and that is work a
schema migration should never be doing. A migration that dies halfway leaves a
database at an unknown revision; this dies halfway and leaves a database that
is simply partly migrated, which every read path already handles because
`serializers.image_url` decides per photograph where it lives.

So it is resumable and idempotent. It only ever looks at rows that still have
their bytes in `data`, and each row is committed on its own, so re-running
after any failure picks up exactly where it stopped.

The bytes are written to the bucket and *verified* before `data` is cleared.
The order matters: the binary must exist in two places at once at some point,
and the moment it exists in neither is the moment a photograph is lost.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import undefer

from .config import get_settings
from .db import SessionLocal
from .models import Image
from .storage import StorageError, get_storage


def _human(byte_count: int) -> str:
    megabytes = byte_count / (1024 * 1024)
    return f"{megabytes:.1f} MB" if megabytes >= 0.1 else f"{byte_count} bytes"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would move, touching neither the bucket nor the database.",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    if not settings.storage_configured:
        print(
            "No bucket configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
            "R2_SECRET_ACCESS_KEY and R2_BUCKET first.",
            file=sys.stderr,
        )
        return 1

    storage = get_storage()
    assert storage is not None  # storage_configured just said so

    session = SessionLocal()
    moved = 0
    freed = 0
    failed = 0
    try:
        # undefer, because `data` is deferred on the model and this is the one
        # job that genuinely wants every byte of it.
        pending = session.scalars(
            select(Image).where(Image.data.is_not(None)).options(undefer(Image.data)).order_by(Image.id)
        ).all()

        if not pending:
            print("Nothing to move: every photograph is already in the bucket.")
            return 0

        total = sum(image.byte_size or len(image.data or b"") for image in pending)
        print(f"{len(pending)} photograph(s) to move, {_human(total)} in total.")

        for image in pending:
            label = f"#{image.id} {image.filename}"
            if args.dry_run:
                print(f"  would move {label} ({_human(image.byte_size)})")
                continue

            data = image.data
            if not data:
                continue

            try:
                key = storage.put(data, image.mime_type)
            except StorageError as exc:
                print(f"  FAILED {label}: {exc}", file=sys.stderr)
                failed += 1
                continue

            # Verify before dropping the only other copy.
            try:
                storage.head(key, expected_size=len(data))
            except StorageError as exc:
                print(f"  FAILED {label}: stored but not readable back: {exc}", file=sys.stderr)
                failed += 1
                continue

            image.storage_key = key
            image.data = None
            session.commit()

            moved += 1
            freed += len(data)
            print(f"  moved {label} -> {key} ({_human(len(data))})")

        if args.dry_run:
            print(f"\nDry run. {len(pending)} photograph(s) would move, {_human(total)} freed.")
            return 0

        print(f"\nMoved {moved} photograph(s). {_human(freed)} freed in Postgres.")
        if failed:
            print(f"{failed} failed and were left in the database. Re-run to retry.", file=sys.stderr)
            return 1
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
