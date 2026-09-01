"""Bespoke prompt copy on a category.

The approved mockups fill the trailing cell of a short category grid with a
prompt rather than white space: "Looking for a console in a specific length or
material?" on console tables, "Need a different height or footprint?" on
plinths.

That is copy, and section 04 requires copy to live in structured data rather
than in template markup, so it is held on the category row and edited in the
console.

Nullable, so this applies to a populated database without touching existing
rows.

Revision ID: 0002_category_prompt
Revises: 0001_catalogue_detail
Create Date: 2026-08-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_category_prompt"
down_revision: str | None = "0001_catalogue_detail"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("bespoke_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("categories", "bespoke_prompt")
