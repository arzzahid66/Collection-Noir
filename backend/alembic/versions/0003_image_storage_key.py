"""Move photography out of Postgres and into object storage.

Photography was held in `images.data` as `bytea`. That was defensible at
catalogue scale and the model documented the reasoning, but it does not fit
the free tier: Neon allows 0.5 GB of storage and 5 GB of egress a month, and
at a couple of megabytes a photograph that is roughly two and a half thousand
image views before the allowance is spent. Cloudflare R2 gives 10 GB and
charges nothing for egress, with no twelve month expiry.

Two changes, and both are additive so this applies to a populated database
without touching a single existing row:

  - `storage_key` records the object key in the bucket. NULL means the binary
    is still in `data`, which is what every existing row means.
  - `data` becomes nullable, so a row uploaded after the cutover can leave it
    empty rather than storing the bytes twice.

Nothing is moved here. The rows are migrated by `python -m app.migrate_images`
once the bucket is configured, which is a separate, resumable step precisely
so that a schema migration never has to stream megabytes over the network.

The downgrade refuses to run if any row has been migrated, because dropping
`storage_key` at that point would orphan the only pointer to the binary.

Revision ID: 0003_image_storage
Revises: 0002_category_prompt
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_image_storage"
down_revision: str | None = "0002_category_prompt"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("images", sa.Column("storage_key", sa.String(length=255), nullable=True))
    with op.batch_alter_table("images") as batch:
        # batch_alter_table because SQLite cannot ALTER a column in place and
        # the test suite runs on SQLite. On Postgres this compiles to a plain
        # ALTER COLUMN ... DROP NOT NULL.
        batch.alter_column("data", existing_type=sa.LargeBinary(), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    migrated = connection.execute(
        sa.text("SELECT COUNT(*) FROM images WHERE storage_key IS NOT NULL")
    ).scalar_one()
    if migrated:
        raise RuntimeError(
            f"{migrated} image(s) have their binary in the bucket. Dropping "
            "storage_key would leave nothing pointing at them. Copy them back "
            "into images.data first."
        )
    with op.batch_alter_table("images") as batch:
        batch.alter_column("data", existing_type=sa.LargeBinary(), nullable=False)
    op.drop_column("images", "storage_key")
