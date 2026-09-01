"""The base schema: every table the catalogue is built from.

This is a repair. The migration chain began at 0001, which starts by adding
columns to `products` and `materials`, so `alembic upgrade head` against an
empty database failed on the first statement: nothing had ever created the
tables. The schema only came into being as a side effect of `app.seed`, which
calls `Base.metadata.create_all`, and that is not something a deploy should
depend on.

So this revision is inserted underneath 0001 and creates the eight tables as
they stood before 0001 ran. Deliberately *not* included here, because the
later revisions add them and a column cannot be added twice:

  0001  products.base, bespoke_box_type, cross_link_slug, spec_sheet,
        care_guide, and materials.swatch_hex
  0002  categories.bespoke_prompt
  0003  images.storage_key, and images.data becoming nullable

An existing database created by `create_all` is already past this point.
Bring it onto the chain with `alembic stamp 0002_category_prompt` rather than
running this, which would fail on tables that are already there.

Revision ID: 0000_initial
Revises:
Create Date: 2026-09-01
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '0000_initial'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('aspect_ratio', sa.String(length=8), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('intro_copy', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_categories_slug'), 'categories', ['slug'], unique=True)
    op.create_table('images',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('mime_type', sa.String(length=80), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('byte_size', sa.Integer(), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('alt_text', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('pages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pages_slug'), 'pages', ['slug'], unique=True)
    op.create_table('materials',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('family', sa.String(length=20), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('finish', sa.String(length=160), nullable=True),
    sa.Column('quarry', sa.String(length=160), nullable=True),
    sa.Column('region', sa.String(length=160), nullable=True),
    sa.Column('origin', sa.String(length=120), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('image_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['image_id'], ['images.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_materials_slug'), 'materials', ['slug'], unique=True)
    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=80), nullable=False),
    sa.Column('category_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('subtitle', sa.String(length=160), nullable=True),
    sa.Column('price_from', sa.Integer(), nullable=True),
    sa.Column('pricing_status', sa.String(length=10), nullable=False),
    sa.Column('purchasable', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('base_description', sa.Text(), nullable=True),
    sa.Column('dimensions', sa.String(length=240), nullable=True),
    sa.Column('lead_time_weeks', sa.String(length=40), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('category_id', 'slug', name='uq_product_category_slug')
    )
    op.create_index(op.f('ix_products_category_id'), 'products', ['category_id'], unique=False)
    op.create_index(op.f('ix_products_slug'), 'products', ['slug'], unique=False)
    op.create_table('enquiries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('email', sa.String(length=240), nullable=False),
    sa.Column('phone', sa.String(length=60), nullable=True),
    sa.Column('company', sa.String(length=200), nullable=True),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=True),
    sa.Column('handled', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('product_images',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('image_id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['image_id'], ['images.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('product_materials',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('material_id', sa.Integer(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('product_id', 'material_id', name='uq_product_material')
    )


def downgrade() -> None:
    op.drop_table('product_materials')
    op.drop_table('product_images')
    op.drop_table('enquiries')
    op.drop_index(op.f('ix_products_slug'), table_name='products')
    op.drop_index(op.f('ix_products_category_id'), table_name='products')
    op.drop_table('products')
    op.drop_index(op.f('ix_materials_slug'), table_name='materials')
    op.drop_table('materials')
    op.drop_index(op.f('ix_pages_slug'), table_name='pages')
    op.drop_table('pages')
    op.drop_table('images')
    op.drop_index(op.f('ix_categories_slug'), table_name='categories')
    op.drop_table('categories')
