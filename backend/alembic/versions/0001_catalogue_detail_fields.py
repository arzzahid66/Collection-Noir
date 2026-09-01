"""Catalogue detail fields from the approved build specification.

Adds the per-product construction and pairing detail the product page needs,
plus a swatch colour on materials for the finish row.

Every column is nullable or carries a server default, so this applies to a
populated database without touching existing rows.

Revision ID: 0001_catalogue_detail
Revises: 0000_initial
Create Date: 2026-08-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_catalogue_detail"
down_revision: str | None = "0000_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("base", sa.String(length=160), nullable=True))
    op.add_column(
        "products",
        sa.Column(
            "bespoke_box_type",
            sa.String(length=20),
            nullable=False,
            server_default="standard",
        ),
    )
    op.add_column(
        "products", sa.Column("cross_link_slug", sa.String(length=80), nullable=True)
    )
    op.add_column("products", sa.Column("spec_sheet", sa.String(length=240), nullable=True))
    op.add_column("products", sa.Column("care_guide", sa.String(length=240), nullable=True))

    op.add_column("materials", sa.Column("swatch_hex", sa.String(length=9), nullable=True))


def downgrade() -> None:
    op.drop_column("materials", "swatch_hex")
    op.drop_column("products", "care_guide")
    op.drop_column("products", "spec_sheet")
    op.drop_column("products", "cross_link_slug")
    op.drop_column("products", "bespoke_box_type")
    op.drop_column("products", "base")
