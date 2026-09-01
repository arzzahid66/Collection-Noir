"""The catalogue matches section 08 of the specification, field by field.

These are the tests that would catch a price being mistyped or an editorial
description drifting away from the approved copy, which is the failure mode that
matters most on a handoff: the site would still work, it would just be wrong.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models import Category, Product, ProductMaterial

# Transcribed directly from section 08. Kept as a literal table rather than
# imported from the seed, so a mistake in the seed cannot make its own test pass.
#
# slug: (category, name, subtitle, price, base, lead time, pairing, box type)
EXPECTED: dict[str, tuple] = {
    "roma": ("dining-tables", "Roma", "Dining table", 6750, "Detachable pedestal", "12-16", None, "standard"),
    "faro": ("dining-tables", "Faro", "Dining table", 12000, None, "12-16", None, "standard"),
    "luna": ("dining-tables", "Luna", "Dining table", 12800, "Double T-framed base", "12-16", None, "standard"),
    "otis-coffee": ("coffee-tables", "Otis", "Coffee table", 2550, "T-framed, shark-nose edge", "8-10", "otis-side", "standard"),
    "otis-oval": ("coffee-tables", "Otis Oval", "Coffee table", 2340, "T-framed, shark-nose edge", "8-10", None, "standard"),
    "ida": ("coffee-tables", "Ida", "Coffee table", 6400, None, "8-10", None, "size_only"),
    "orla": ("console-tables", "Orla", "Console table", 3750, "Paired leg", "8-10", None, "standard"),
    "esme": ("console-tables", "Esme", "Console table", 3460, "Angled monolith base", "8-10", None, "standard"),
    "otis-side": ("side-tables", "Otis", "Side table", 1700, "T-framed, shark-nose edge", "8-10", "otis-coffee", "standard"),
    "ria": ("side-tables", "Ria", "Side table", 1700, "Tapered cylindrical form", "8-10", None, "standard"),
    "alaia": ("side-tables", "Alaia", "Side table", 1900, "Solid cube", "8-10", None, "standard"),
    "oria-side": ("side-tables", "Oria", "Side table", 2200, "Turned cylinder", "8-10", "oria-plinth", "standard"),
    "nova": ("plinths", "Nova", "Plinth", 1500, "Mitred edge", "8-10", None, "standard"),
    "oria-plinth": ("plinths", "Oria", "Plinth", 3730, "Turned cylinder", "8-10", "oria-side", "standard"),
}

# The finish list per piece, in order, the first being the default shown.
EXPECTED_FINISHES: dict[str, list[str]] = {
    "roma": ["Nero Marquina", "Calacatta Viola", "Cipollino Verde", "Travertine Classic"],
    "faro": ["Calacatta Viola", "Calacatta Arni", "Arabescato Vagli"],
    "luna": ["Arabescato Vagli", "Cipollino Verde", "Calacatta Viola", "Calacatta Arni"],
    "otis-coffee": ["Calacatta Viola", "Cipollino Verde", "Nero Marquina", "Arabescato Vagli"],
    "otis-oval": ["Calacatta Monet", "Cipollino Verde", "Calacatta Viola"],
    "ida": ["Travertine Classic", "Onyx"],
    "orla": ["Fantasy Brown", "Calacatta Viola", "Nero Marquina", "Travertine Classic"],
    "esme": ["Calacatta Monet", "Calacatta Arni", "Nero Marquina", "Travertine Classic"],
    "otis-side": ["Calacatta Viola", "Cipollino Verde", "Nero Marquina", "Arabescato Vagli"],
    "ria": ["Travertine Classic", "Breccia Versilia", "Nero Marquina"],
    "alaia": ["Calacatta Viola", "Breccia Versilia", "Travertine Classic"],
    "oria-side": ["Nero Marquina", "Cipollino Verde", "Travertine Classic"],
    "nova": ["Calacatta Viola", "Nero Marquina", "Cipollino Verde", "Travertine Classic"],
    "oria-plinth": ["Nero Marquina", "Cipollino Verde", "Travertine Classic"],
}

# Section 07, the confirmed aspect ratio per category.
EXPECTED_RATIOS = {
    "dining-tables": "3-2",
    "coffee-tables": "3-2",
    "console-tables": "4-5",
    "side-tables": "4-5",
    "bedside-tables": "4-5",
    "plinths": "4-5",
}


def _product(db, slug: str) -> Product:
    return db.scalar(
        select(Product).options(joinedload(Product.category)).where(Product.slug == slug)
    )


def test_fourteen_pieces_are_confirmed_for_launch(db):
    """Section 08: fourteen products confirmed for launch, fully priced."""
    live = db.scalars(select(Product).where(Product.status == "live")).all()
    assert len(live) == 14
    assert {p.slug for p in live} == set(EXPECTED)


def test_every_launch_piece_has_a_confirmed_price(db):
    """Section 09: every live product must show a confirmed starting price."""
    for product in db.scalars(select(Product).where(Product.status == "live")):
        assert product.price_from is not None, product.slug
        assert product.pricing_status == "from", product.slug


def test_no_launch_piece_uses_price_on_application(db):
    """Section 09: no POA pricing at launch."""
    poa = db.scalars(select(Product).where(Product.pricing_status == "poa")).all()
    assert poa == []


def test_launch_prices_are_round_numbers(db):
    """Section 09: all launch prices end in a zero at the data level."""
    for product in db.scalars(select(Product).where(Product.status == "live")):
        assert product.price_from % 10 == 0, f"{product.slug} is {product.price_from}"


@pytest.mark.parametrize("slug", sorted(EXPECTED))
def test_piece_matches_the_specification(db, slug):
    category, name, subtitle, price, base, lead, pairing, box = EXPECTED[slug]
    product = _product(db, slug)
    assert product is not None, f"{slug} is missing from the catalogue"
    assert product.category.slug == category
    assert product.name == name
    assert product.subtitle == subtitle
    assert product.price_from == price
    assert product.base == base
    assert product.lead_time_weeks == lead
    assert product.cross_link_slug == pairing
    assert product.bespoke_box_type == box
    assert product.status == "live"
    # Section 02 rules out cart and checkout language, so nothing is
    # purchasable at launch.                                    copy-lint-ok
    assert product.purchasable is False


@pytest.mark.parametrize("slug", sorted(EXPECTED_FINISHES))
def test_finishes_match_the_specification(db, slug):
    product = _product(db, slug)
    links = sorted(product.materials, key=lambda link: link.sort_order)
    assert [link.material.name for link in links] == EXPECTED_FINISHES[slug]
    # Exactly one default, and it is the first, which is the finish shown.
    defaults = [link for link in links if link.is_default]
    assert len(defaults) == 1
    assert defaults[0].material.name == EXPECTED_FINISHES[slug][0]


def test_ida_finish_is_a_fixed_pairing(db):
    """Section 08: Ida's finish is fixed, so it can only be varied by size."""
    ida = _product(db, "ida")
    assert ida.bespoke_box_type == "size_only"
    assert [link.material.name for link in sorted(ida.materials, key=lambda x: x.sort_order)] == [
        "Travertine Classic",
        "Onyx",
    ]


def test_every_piece_carries_editorial_copy(db):
    for product in db.scalars(select(Product)):
        assert product.base_description, product.slug
        # Section 02 rules out em dashes.                        copy-lint-ok
        assert "—" not in product.base_description, product.slug


def test_roma_description_is_the_approved_copy(db):
    """Spot check one description word for word against section 08."""
    roma = _product(db, "roma")
    assert roma.base_description.startswith(
        "Characterised by its tapered base and chamfered edge, the Roma is a "
        "striking, timeless centrepiece, hand-carved to order at our workshop "
        "in Italy."
    )


def test_dimensions_are_present_and_splittable(db):
    """Figure 3 sets each measurement in its own cell, split on a slash."""
    roma = _product(db, "roma")
    parts = [p.strip() for p in roma.dimensions.split("/")]
    assert parts == ["D1.3m (4-6 seats)", "D1.6m (6-8 seats)", "H75cm"]


def test_orla_and_esme_share_a_footprint(db):
    """Section 07 point 4: two pieces of the same real size must be able to
    read at consistent scale, which starts with the data agreeing."""
    assert _product(db, "orla").dimensions == _product(db, "esme").dimensions == "120x25x75cm"


# --------------------------------------------------------------------- Kaia


def test_kaia_is_in_the_model_but_held_off_the_site(db):
    """Section 08: Kaia is built into the data model and excluded from launch."""
    kaia = _product(db, "kaia")
    assert kaia is not None
    assert kaia.status == "paused"
    assert kaia.price_from is None
    assert kaia.images == []
    assert kaia.is_publishable is False
    assert kaia.lead_time_weeks == "12-14"


def test_kaia_still_carries_its_copy_and_finishes(db):
    """The record is complete apart from price and photography, so releasing it
    is a matter of supplying those two rather than re-entering the piece."""
    kaia = _product(db, "kaia")
    assert kaia.dimensions == "60x47x56cm / 3 drawers"
    names = {link.material.name for link in kaia.materials}
    assert names == {"Travertine Osso", "Stained Oak", "Bronze Patina"}


# ---------------------------------------------------------------- Categories


def test_six_live_categories(db):
    """Section 05 names six categories, and figure 2 shows six tiles."""
    live = db.scalars(select(Category).where(Category.status == "live")).all()
    assert [c.slug for c in sorted(live, key=lambda c: c.sort_order)] == [
        "dining-tables",
        "coffee-tables",
        "console-tables",
        "side-tables",
        "bedside-tables",
        "plinths",
    ]


def test_categories_outside_the_specification_are_hidden(db):
    for slug in ("chest-of-drawers", "dressing-tables-and-desks"):
        category = db.scalar(select(Category).where(Category.slug == slug))
        assert category.status == "hidden", slug


@pytest.mark.parametrize("slug,ratio", sorted(EXPECTED_RATIOS.items()))
def test_aspect_ratio_is_per_category(db, slug, ratio):
    """Section 07: the confirmed ratio per category, never one global default."""
    assert db.scalar(select(Category).where(Category.slug == slug)).aspect_ratio == ratio


def test_ratios_are_not_all_the_same(db):
    """Guards the actual point of section 07. A single site-wide ratio would
    still satisfy each individual assertion above if they all matched."""
    ratios = {c.aspect_ratio for c in db.scalars(select(Category)) if c.status == "live"}
    assert ratios == {"3-2", "4-5"}


def test_every_live_category_carries_a_bespoke_prompt(db):
    """Figures 6 and 8 fill a short grid's trailing cell with a prompt, and it
    is held as data rather than in markup."""
    for category in db.scalars(select(Category).where(Category.status == "live")):
        assert category.bespoke_prompt, category.slug
        assert category.intro_copy, category.slug


def test_material_language_avoids_stone_in_prompts(db):
    """Section 02: brand copy says "material", not "stone"."""
    for category in db.scalars(select(Category).where(Category.status == "live")):
        assert "stone" not in (category.bespoke_prompt or "").lower(), category.slug


# ---------------------------------------------------------------- Pairings


def test_pairings_are_symmetric(db):
    pairs = [("otis-coffee", "otis-side"), ("oria-side", "oria-plinth")]
    for left, right in pairs:
        assert _product(db, left).cross_link_slug == right
        assert _product(db, right).cross_link_slug == left


def test_pairing_slugs_are_unambiguous(db):
    """A bare "oria" would match both the side table and the plinth, so the
    pairing depends on the distinct slugs section 08 gives."""
    slugs = [p.slug for p in db.scalars(select(Product))]
    assert len(slugs) == len(set(slugs))


# ------------------------------------------------------------- Spec sheets


def test_every_piece_points_at_a_slug_based_spec_sheet(db):
    """Section 04: slug-based filenames mapping to a /spec-sheets/ directory."""
    for product in db.scalars(select(Product)):
        assert product.spec_sheet == f"{product.slug}-spec-sheet.pdf", product.slug
        assert product.care_guide == "collection-noir-care-guide.pdf", product.slug


def test_materials_library_holds_every_finish_the_document_names(db):
    from app.models import Material

    names = {m.name for m in db.scalars(select(Material))}
    for finishes in EXPECTED_FINISHES.values():
        for finish in finishes:
            assert finish in names, finish


def test_swatch_colours_are_not_pure_black_or_white(db):
    """Section 03: pure black is not substituted anywhere."""
    from app.models import Material

    for material in db.scalars(select(Material)):
        if material.swatch_hex:
            assert material.swatch_hex.lower() not in {"#000", "#000000", "#fff", "#ffffff"}
