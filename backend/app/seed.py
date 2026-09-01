"""First-time setup and catalogue sync.

Creates the schema, then seeds the category structure, the materials library,
the standing page copy and the launch catalogue from section 08 of the Website
Build Specification.

Prices, editorial copy, dimensions, bases, lead times, finishes and pairings all
come from that section and are applied on every run, so the document stays the
source of truth for catalogue content. Anything the console owns rather than the
document, notably photography and sort order, is never overwritten.

Fourteen pieces are confirmed for launch and fully priced. Kaia is built into
the data model but held off the live site: no confirmed price and no product
photography. It stays paused until both are entered.

A priced piece still needs at least one photograph before it reaches the public
site. That gate lives on the model, so the fourteen appear the moment their
photography is attached through the console and not before.

Run with:  python -m app.seed
Re-running is safe.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import Category, Material, Page, Product, ProductMaterial

# ---------------------------------------------------------------------------
# Categories
#
# Six categories, per section 05. Aspect ratio is a per-category decision from
# the table in section 07: landscape for the wide pieces, portrait for the
# small-scale and tall ones. There is deliberately no site-wide default.
#
# The bespoke prompt fills the trailing cell of a short category grid, as in
# figures 6 and 8.
# ---------------------------------------------------------------------------

CATEGORIES: list[dict] = [
    {
        "slug": "dining-tables",
        "name": "Dining Tables",
        "aspect_ratio": "3-2",
        "sort_order": 0,
        "status": "live",
        "intro_copy": "Each piece is designed in London and made by hand in Italy.",
        "bespoke_prompt": "Looking for a table at a specific length or in another material?",
    },
    {
        "slug": "coffee-tables",
        "name": "Coffee Tables",
        "aspect_ratio": "3-2",
        "sort_order": 1,
        "status": "live",
        "intro_copy": "Lower forms, cut and finished to the same standard as the dining pieces.",
        "bespoke_prompt": "Looking for a low table in a specific size or material?",
    },
    {
        "slug": "console-tables",
        "name": "Console Tables",
        "aspect_ratio": "4-5",
        "sort_order": 2,
        "status": "live",
        "intro_copy": "Single planes of material, held on a leg or a monolith base.",
        "bespoke_prompt": "Looking for a console in a specific length or material?",
    },
    {
        "slug": "side-tables",
        "name": "Side Tables",
        "aspect_ratio": "4-5",
        "sort_order": 3,
        "status": "live",
        "intro_copy": "Smaller pieces, made to sit beside a sofa or a chair.",
        "bespoke_prompt": "Looking for a side table at a different height?",
    },
    {
        "slug": "bedside-tables",
        "name": "Bedside Tables",
        "aspect_ratio": "4-5",
        "sort_order": 4,
        "status": "live",
        "intro_copy": "Case goods bringing material, timber and hand-cast bronze together.",
        "bespoke_prompt": "Looking for a bedside piece in a specific size or material?",
    },
    {
        "slug": "plinths",
        "name": "Plinths",
        "aspect_ratio": "4-5",
        "sort_order": 5,
        "status": "live",
        "intro_copy": "Columns cut from a single block, mitred or turned.",
        "bespoke_prompt": "Need a different height or footprint?",
    },
    # Held off the site. Section 05 names six categories and figure 2 shows six
    # tiles. These two came from a separate build brief. They are kept as hidden
    # rows rather than deleted, so nothing is lost if the client confirms them,
    # and the discrepancy is logged in PENDING_CHANGES.md.
    {
        "slug": "chest-of-drawers",
        "name": "Chest of Drawers",
        "aspect_ratio": "4-5",
        "sort_order": 6,
        "status": "hidden",
        "intro_copy": None,
        "bespoke_prompt": None,
    },
    {
        "slug": "dressing-tables-and-desks",
        "name": "Dressing Tables and Desks",
        "aspect_ratio": "4-5",
        "sort_order": 7,
        "status": "hidden",
        "intro_copy": None,
        "bespoke_prompt": None,
    },
]

# ---------------------------------------------------------------------------
# Materials
#
# Every finish named across section 08. Swatch colours are approximations used
# only for the small swatch row on a product page; the photograph remains the
# honest representation of the material, and the product page says so.
#
# Provenance is stated by quarry and region where it is known. Where it is not,
# the field is left empty rather than filled with a plausible guess, and the
# gap is listed in PENDING_CHANGES.md for the brand team to confirm.
# ---------------------------------------------------------------------------

MATERIALS: list[dict] = [
    {
        "slug": "nero-marquina",
        "name": "Nero Marquina",
        "family": "marble",
        "quarry": "Markina",
        "region": "Biscay",
        "origin": "Spain",
        "finish": "Honed",
        "swatch_hex": "#211d1b",
        "sort_order": 0,
        "description": (
            "A dense black limestone with white calcite veining. Honed rather than "
            "polished, so the surface holds light instead of returning it."
        ),
    },
    {
        "slug": "calacatta-viola",
        "name": "Calacatta Viola",
        "family": "marble",
        "quarry": "Carrara basin",
        "region": "Tuscany",
        "origin": "Italy",
        "finish": "Honed or polished",
        "swatch_hex": "#e3d7cd",
        "sort_order": 1,
        "description": (
            "A white ground crossed by veining that runs from oxblood through to "
            "aubergine. The veining is directional, so the block is read before it "
            "is cut and the run of the pattern across a top is decided at the "
            "quarry rather than in the workshop."
        ),
    },
    {
        "slug": "cipollino-verde",
        "name": "Cipollino Verde",
        "family": "marble",
        "quarry": None,
        "region": "Tuscany",
        "origin": "Italy",
        "finish": "Honed",
        "swatch_hex": "#4a5a4a",
        "sort_order": 2,
        "description": (
            "A green marble banded in pale grey and white, the layering running in "
            "parallel seams that read as one continuous movement across a top."
        ),
    },
    {
        "slug": "travertine-classic",
        "name": "Travertine Classic",
        "family": "marble",
        "quarry": "Tivoli",
        "region": "Lazio",
        "origin": "Italy",
        "finish": "Filled and honed",
        "swatch_hex": "#d9cbb4",
        "sort_order": 3,
        "description": (
            "A warm cream travertine from the beds east of Rome. Filled and honed "
            "for a level surface that keeps the open bedding visible at the edge."
        ),
    },
    {
        "slug": "calacatta-arni",
        "name": "Calacatta Arni",
        "family": "marble",
        "quarry": "Arni",
        "region": "Tuscany",
        "origin": "Italy",
        "finish": "Honed or polished",
        "swatch_hex": "#e7e1d6",
        "sort_order": 4,
        "description": (
            "Quarried above the village of Arni in the Apuan Alps. A cooler white "
            "than the Viola, veined in grey and gold rather than red."
        ),
    },
    {
        "slug": "arabescato-vagli",
        "name": "Arabescato Vagli",
        "family": "marble",
        "quarry": "Vagli",
        "region": "Tuscany",
        "origin": "Italy",
        "finish": "Honed or polished",
        "swatch_hex": "#ddd6ca",
        "sort_order": 5,
        "description": (
            "A white marble with grey veining that closes into dense figuring in "
            "places and opens into clear ground in others."
        ),
    },
    {
        "slug": "calacatta-monet",
        "name": "Calacatta Monet",
        "family": "marble",
        "quarry": "Carrara basin",
        "region": "Tuscany",
        "origin": "Italy",
        "finish": "Honed or polished",
        "swatch_hex": "#dcd3c6",
        "sort_order": 6,
        "description": (
            "Soft grey veining laid over a warm white ground, the pattern more "
            "diffuse than the other Calacattas the atelier works with."
        ),
    },
    {
        "slug": "fantasy-brown",
        "name": "Fantasy Brown",
        "family": "marble",
        "quarry": None,
        "region": None,
        "origin": "India",
        "finish": "Honed",
        "swatch_hex": "#8d7f6d",
        "sort_order": 7,
        "description": (
            "A quartzite in browns and greys, the movement running in wide bands "
            "rather than discrete veins."
        ),
    },
    {
        "slug": "breccia-versilia",
        "name": "Breccia Versilia",
        "family": "marble",
        "quarry": None,
        "region": "Versilia",
        "origin": "Italy",
        "finish": "Honed",
        "swatch_hex": "#9a8375",
        "sort_order": 8,
        "description": (
            "A breccia from the Versilia coast, fragments of pale stone set in a "
            "warmer matrix so the surface reads as assembled rather than veined."
        ),
    },
    {
        "slug": "onyx",
        "name": "Onyx",
        "family": "marble",
        "quarry": None,
        "region": None,
        "origin": None,
        "finish": "Polished",
        "swatch_hex": "#c8b49a",
        "sort_order": 9,
        "description": (
            "Used by the atelier as an inlay rather than as a surface. Cut into a "
            "narrow line and set into the edge of another material."
        ),
    },
    {
        "slug": "travertine-osso",
        "name": "Travertine Osso",
        "family": "marble",
        "quarry": "Tivoli",
        "region": "Lazio",
        "origin": "Italy",
        "finish": "Filled and honed",
        "swatch_hex": "#e0d5c2",
        "sort_order": 10,
        "description": (
            "The palest of the Tivoli travertines, cut across the bed so the "
            "bedding reads as a fine even grain rather than as open seams."
        ),
    },
    {
        "slug": "stained-oak",
        "name": "Stained Oak",
        "family": "timber",
        "quarry": None,
        "region": None,
        "origin": None,
        "finish": "Stained and hand oiled",
        "swatch_hex": "#5c4a3a",
        "sort_order": 11,
        "description": (
            "Kiln dried, stained, then hand oiled. Boards are matched across a "
            "face so the figure runs continuously rather than breaking at a joint."
        ),
    },
    {
        "slug": "bronze-patina",
        "name": "Bronze Patina",
        "family": "metal",
        "quarry": None,
        "region": None,
        "origin": None,
        "finish": "Hand patinated, waxed",
        "swatch_hex": "#7a6242",
        "sort_order": 12,
        "description": (
            "Cast and worked by hand. The patina is applied by hand and will "
            "continue to move for the first year in a room, then settle."
        ),
    },
]

# ---------------------------------------------------------------------------
# Launch catalogue, section 08
#
# Slugs follow the document, which names the paired pieces as otis-coffee and
# otis-side, oria-side and oria-plinth. Distinct slugs are what make the
# cross-reference unambiguous: a bare "oria" would match both the side table
# and the plinth.
#
# Lead times come from the document: twelve to sixteen weeks for dining tables,
# eight to ten for everything else, twelve to fourteen for Kaia.
#
# `dimensions` is free text per the schema. Measurements are separated with a
# slash so the product page can set each in its own cell, as in figure 3.
# ---------------------------------------------------------------------------

DINING = "12-16"
SMALL = "8-10"

PRODUCTS: list[dict] = [
    # ----------------------------------------------------------- Dining tables
    {
        "slug": "roma",
        "category": "dining-tables",
        "name": "Roma",
        "subtitle": "Dining table",
        "price_from": 6750,
        "base": "Detachable pedestal",
        "dimensions": "D1.3m (4-6 seats) / D1.6m (6-8 seats) / H75cm",
        "lead_time_weeks": DINING,
        "description": (
            "Characterised by its tapered base and chamfered edge, the Roma is a "
            "striking, timeless centrepiece, hand-carved to order at our workshop "
            "in Italy. The pedestal base is detachable. Shown in Nero Marquina; "
            "also available in Calacatta Viola, Cipollino Verde and Travertine "
            "Classic."
        ),
        "materials": [
            "nero-marquina",
            "calacatta-viola",
            "cipollino-verde",
            "travertine-classic",
        ],
    },
    {
        "slug": "faro",
        "category": "dining-tables",
        "name": "Faro",
        "subtitle": "Dining table",
        "price_from": 12000,
        "base": None,
        "dimensions": "220x100x75cm",
        "lead_time_weeks": DINING,
        "description": (
            "A contemporary interpretation of Roman architecture. The legs carry a "
            "linear fluting that catches the light along their length, a detail "
            "that elevates without competing with the stone. Shown in Calacatta "
            "Viola; also available in Calacatta Arni and Arabescato Vagli."
        ),
        "materials": ["calacatta-viola", "calacatta-arni", "arabescato-vagli"],
    },
    {
        "slug": "luna",
        "category": "dining-tables",
        "name": "Luna",
        "subtitle": "Dining table",
        "price_from": 12800,
        "base": "Double T-framed base",
        "dimensions": "240x120x76cm / 8 seats / Pill-shaped top, bullnose edge",
        "lead_time_weeks": DINING,
        "description": (
            "The Luna is designed for the larger room, a generous oval with a "
            "bullnose edge and a double T-framed base that holds the form without "
            "competing with it. Seats up to eight. Shown in Arabescato Vagli; also "
            "available in Cipollino Verde, Calacatta Viola and Calacatta Arni."
        ),
        "materials": [
            "arabescato-vagli",
            "cipollino-verde",
            "calacatta-viola",
            "calacatta-arni",
        ],
    },
    # ----------------------------------------------------------- Coffee tables
    {
        "slug": "otis-coffee",
        "category": "coffee-tables",
        "name": "Otis",
        "subtitle": "Coffee table",
        "price_from": 2550,
        "base": "T-framed, shark-nose edge",
        "dimensions": "D100 x H30cm",
        "lead_time_weeks": SMALL,
        "cross_link_slug": "otis-side",
        "description": (
            "Drawing on mid-century design, the Otis pairs a sleek T-framed base "
            "with a shark-nose edge profile, lending both function and form to a "
            "softly curved top. The same design is carried through at a smaller "
            "scale in the Otis side table, so the two can be placed together as a "
            "pair. Shown in Calacatta Viola; also available in Cipollino Verde, "
            "Nero Marquina and Arabescato Vagli."
        ),
        "materials": [
            "calacatta-viola",
            "cipollino-verde",
            "nero-marquina",
            "arabescato-vagli",
        ],
    },
    {
        "slug": "otis-oval",
        "category": "coffee-tables",
        "name": "Otis Oval",
        "subtitle": "Coffee table",
        "price_from": 2340,
        "base": "T-framed, shark-nose edge",
        "dimensions": "120x80x30cm",
        "lead_time_weeks": SMALL,
        "description": (
            "The T-framed base and shark-nose edge are cut from the same block, so "
            "the top reads as a single continuous surface. The oval form gives the "
            "Otis a longer line than its original, suited to a wider seating "
            "arrangement. Shown in Calacatta Monet; also available in Cipollino "
            "Verde and Calacatta Viola."
        ),
        "materials": ["calacatta-monet", "cipollino-verde", "calacatta-viola"],
    },
    {
        "slug": "ida",
        "category": "coffee-tables",
        "name": "Ida",
        "subtitle": "Coffee table",
        "price_from": 6400,
        "base": None,
        "dimensions": "130x65x30cm",
        "lead_time_weeks": SMALL,
        # The finish is a fixed pairing, so this piece can only be varied by
        # size. Section 08.
        "bespoke_box_type": "size_only",
        "description": (
            "A sculptural base lifts the top so it appears to float, with an inset "
            "onyx line set into the travertine edge. The construction is "
            "deliberately quiet, the detail reveals itself only on a second look. "
            "Shown in Classic Travertine with an Onyx inlay."
        ),
        "materials": ["travertine-classic", "onyx"],
    },
    # ---------------------------------------------------------- Console tables
    {
        "slug": "orla",
        "category": "console-tables",
        "name": "Orla",
        "subtitle": "Console table",
        "price_from": 3750,
        "base": "Paired leg",
        "dimensions": "120x25x75cm",
        "lead_time_weeks": SMALL,
        "description": (
            "A single plane of stone held on a paired leg, the Orla brings a quiet "
            "presence to an entry or corridor. Shown in Fantasy Brown; also "
            "available in Calacatta Viola, Nero Marquina and Travertine Classic."
        ),
        "materials": [
            "fantasy-brown",
            "calacatta-viola",
            "nero-marquina",
            "travertine-classic",
        ],
    },
    {
        "slug": "esme",
        "category": "console-tables",
        "name": "Esme",
        "subtitle": "Console table",
        "price_from": 3460,
        "base": "Angled monolith base",
        # Identical footprint and height to the Orla. Section 07 point 4 asks
        # that two pieces sharing real-world dimensions read at consistent
        # scale in the grid, which is a photography brief note rather than
        # anything the template can compensate for.
        "dimensions": "120x25x75cm",
        "lead_time_weeks": SMALL,
        "description": (
            "Where the Orla carries a paired leg, the Esme rests on an angled "
            "monolith base that tapers to the floor. The geometry changes the "
            "weight of the piece entirely. Shown in Calacatta Monet; also "
            "available in Calacatta Arni, Nero Marquina and Travertine Classic."
        ),
        "materials": [
            "calacatta-monet",
            "calacatta-arni",
            "nero-marquina",
            "travertine-classic",
        ],
    },
    # ------------------------------------------------------------- Side tables
    {
        "slug": "otis-side",
        "category": "side-tables",
        "name": "Otis",
        "subtitle": "Side table",
        "price_from": 1700,
        "base": "T-framed, shark-nose edge",
        "dimensions": "D43 x H45cm",
        "lead_time_weeks": SMALL,
        "cross_link_slug": "otis-coffee",
        "description": (
            "The Otis side table carries the same T-framed base and shark-nose "
            "profile as the coffee table, scaled to sit beside a sofa or chair. "
            "The two pieces are designed to sit together as a pair. Shown in "
            "Calacatta Viola; also available in Cipollino Verde, Nero Marquina "
            "and Arabescato Vagli."
        ),
        "materials": [
            "calacatta-viola",
            "cipollino-verde",
            "nero-marquina",
            "arabescato-vagli",
        ],
    },
    {
        "slug": "ria",
        "category": "side-tables",
        "name": "Ria",
        "subtitle": "Side table",
        "price_from": 1700,
        "base": "Tapered cylindrical form",
        "dimensions": "D40 x H50cm",
        "lead_time_weeks": SMALL,
        "description": (
            "A tapered cylindrical form, cut from a single block of stone. The Ria "
            "stands slightly taller than most side tables, suited to a higher seat "
            "or a position alongside an armchair. Shown in Travertine Classic; "
            "also available in Breccia Versilia and Nero Marquina."
        ),
        "materials": ["travertine-classic", "breccia-versilia", "nero-marquina"],
    },
    {
        "slug": "alaia",
        "category": "side-tables",
        "name": "Alaia",
        "subtitle": "Side table",
        "price_from": 1900,
        "base": "Solid cube",
        "dimensions": "40x40x40cm",
        "lead_time_weeks": SMALL,
        "description": (
            "A solid cube of stone, five faces finished, the sixth left raw "
            "against the floor. The Alaia is more object than table, it reads as a "
            "sculptural piece in a room and functions as a surface. Shown in "
            "Calacatta Viola; also available in Breccia Versilia and Travertine "
            "Classic."
        ),
        "materials": ["calacatta-viola", "breccia-versilia", "travertine-classic"],
    },
    {
        "slug": "oria-side",
        "category": "side-tables",
        "name": "Oria",
        "subtitle": "Side table",
        "price_from": 2200,
        "base": "Turned cylinder",
        "dimensions": "D30 x H50cm",
        "lead_time_weeks": SMALL,
        "cross_link_slug": "oria-plinth",
        "description": (
            "A single cylinder of stone, turned and left unadorned. The veining "
            "reads as one unbroken sweep around the form. The same form is "
            "available at a taller height as the Oria plinth. Shown in Nero "
            "Marquina; also available in Cipollino Verde and Travertine Classic."
        ),
        "materials": ["nero-marquina", "cipollino-verde", "travertine-classic"],
    },
    # ----------------------------------------------------------------- Plinths
    {
        "slug": "nova",
        "category": "plinths",
        "name": "Nova",
        "subtitle": "Plinth",
        "price_from": 1500,
        "base": "Mitred edge",
        "dimensions": "30x30x60cm / 25x25x65cm (two sizes)",
        "lead_time_weeks": SMALL,
        "description": (
            "A mitred-edge column cut from a single block of stone. The Nova is "
            "available in two footprints, wider and lower, or narrower and taller. "
            "Shown in Calacatta Viola; also available in Nero Marquina, Cipollino "
            "Verde and Travertine Classic."
        ),
        "materials": [
            "calacatta-viola",
            "nero-marquina",
            "cipollino-verde",
            "travertine-classic",
        ],
    },
    {
        "slug": "oria-plinth",
        "category": "plinths",
        "name": "Oria",
        "subtitle": "Plinth",
        "price_from": 3730,
        "base": "Turned cylinder",
        "dimensions": "D30 x H90cm",
        "lead_time_weeks": SMALL,
        "cross_link_slug": "oria-side",
        "description": (
            "A single cylinder of stone, cut tall and left otherwise unadorned. "
            "Where the Nova holds its line with a mitred edge, the Oria turns "
            "continuously, so the veining reads as one unbroken sweep around the "
            "form. The same form is available at a lower height as the Oria side "
            "table. Shown in Nero Marquina; also available in Cipollino Verde and "
            "Travertine Classic."
        ),
        "materials": ["nero-marquina", "cipollino-verde", "travertine-classic"],
    },
    # ------------------------------------------------------ Excluded from launch
    #
    # Built into the data model and the template but not rendered on the live
    # site until a price and photography are confirmed. Section 08.
    {
        "slug": "kaia",
        "category": "bedside-tables",
        "name": "Kaia",
        "subtitle": "Bedside table",
        "price_from": None,
        "status": "paused",
        "base": "Stone and timber with hand-cast bronze knobs",
        "dimensions": "60x47x56cm / 3 drawers",
        "lead_time_weeks": "12-14",
        "description": (
            "Stone and timber brought together in a single piece, with hand-cast "
            "bronze knobs as the connecting element. The Kaia is designed to hold "
            "the bedside without calling attention to itself. Made in Travertine "
            "Osso and Stained Oak with Bronze Patina hardware."
        ),
        "materials": ["travertine-osso", "stained-oak", "bronze-patina"],
    },
]

# Slugs that changed when the catalogue was aligned to section 08, so an
# existing database is carried across rather than left with orphaned rows.
SLUG_RENAMES: list[tuple[str, str, str]] = [
    ("coffee-tables", "otis", "otis-coffee"),
    ("side-tables", "otis", "otis-side"),
    ("side-tables", "oria", "oria-side"),
    ("plinths", "oria", "oria-plinth"),
]

# One shared care guide rather than one per piece. Section 04 requires a spec
# sheet per product; the care guide is a single document the whole collection
# points at, as in figure 3.
CARE_GUIDE = "collection-noir-care-guide.pdf"


def seed_categories(db: Session) -> None:
    """Create or update every category.

    Ratio, status, intro copy and the bespoke prompt all come from the
    specification, so they are applied on every run. Sort order is left alone
    once a row exists, because the console owns it.
    """
    for row in CATEGORIES:
        existing = db.scalar(select(Category).where(Category.slug == row["slug"]))
        if existing is None:
            db.add(Category(**row))
            continue
        existing.name = row["name"]
        existing.aspect_ratio = row["aspect_ratio"]
        existing.status = row["status"]
        existing.intro_copy = row["intro_copy"]
        existing.bespoke_prompt = row["bespoke_prompt"]
    db.commit()


def seed_materials(db: Session) -> None:
    for row in MATERIALS:
        existing = db.scalar(select(Material).where(Material.slug == row["slug"]))
        if existing is None:
            db.add(Material(**row))
            continue
        for field, value in row.items():
            if field != "slug":
                setattr(existing, field, value)
    db.commit()


def rename_legacy_slugs(db: Session) -> None:
    for category_slug, old, new in SLUG_RENAMES:
        category = db.scalar(select(Category).where(Category.slug == category_slug))
        if category is None:
            continue
        # Only rename when the new slug is not already present, so this is safe
        # to run repeatedly.
        if db.scalar(
            select(Product).where(
                Product.category_id == category.id, Product.slug == new
            )
        ):
            continue
        legacy = db.scalar(
            select(Product).where(
                Product.category_id == category.id, Product.slug == old
            )
        )
        if legacy is not None:
            legacy.slug = new
    db.commit()


def seed_products(db: Session) -> None:
    """Create or update every piece from section 08.

    Catalogue content the document owns is applied on every run. Photography is
    never touched, because the console owns it and the document supplies none.
    Sort order is set only when the row is created.
    """
    categories = {c.slug: c for c in db.scalars(select(Category)).all()}
    materials = {m.slug: m for m in db.scalars(select(Material)).all()}

    for position, row in enumerate(PRODUCTS):
        category = categories[row["category"]]
        product = db.scalar(
            select(Product).where(
                Product.category_id == category.id,
                Product.slug == row["slug"],
            )
        )
        if product is None:
            product = Product(
                slug=row["slug"],
                category_id=category.id,
                sort_order=position,
            )
            db.add(product)

        product.name = row["name"]
        product.subtitle = row["subtitle"]
        product.price_from = row["price_from"]
        product.pricing_status = "from"
        # No launch piece is purchasable. Section 02 rules out cart and
        # checkout language because nothing is held in stock.  copy-lint-ok
        product.purchasable = False
        product.base = row.get("base")
        product.dimensions = row["dimensions"]
        product.lead_time_weeks = row["lead_time_weeks"]
        product.base_description = row["description"]
        product.bespoke_box_type = row.get("bespoke_box_type", "standard")
        product.cross_link_slug = row.get("cross_link_slug")
        product.spec_sheet = f"{row['slug']}-spec-sheet.pdf"
        product.care_guide = CARE_GUIDE
        product.status = row.get("status", "live")

        db.flush()
        _sync_materials(db, product, row["materials"], materials)

    db.commit()


def _sync_materials(
    db: Session,
    product: Product,
    slugs: list[str],
    materials: dict[str, Material],
) -> None:
    """Attach the finishes the document lists, first one as the default.

    Links the document no longer lists are removed, so a finish withdrawn from
    the specification disappears from the swatch row rather than lingering.
    """
    wanted = [materials[slug] for slug in slugs if slug in materials]
    wanted_ids = {m.id for m in wanted}

    for link in list(product.materials):
        if link.material_id not in wanted_ids:
            db.delete(link)

    existing = {link.material_id: link for link in product.materials}
    for order, material in enumerate(wanted):
        link = existing.get(material.id)
        if link is None:
            db.add(
                ProductMaterial(
                    product_id=product.id,
                    material_id=material.id,
                    is_default=(order == 0),
                    sort_order=order,
                )
            )
        else:
            link.is_default = order == 0
            link.sort_order = order


def seed_pages(db: Session, refresh: Sequence[str] = ()) -> None:
    """Create any page that does not exist yet.

    An existing page is left alone. Copy is edited in the console, and
    overwriting it here would discard the brand team's wording.

    A slug named in `refresh` is the exception: it is rewritten from this file.
    That is how an approved copy correction reaches a database that has already
    been seeded, and it is opt in per slug so it can never sweep the console's
    edits away wholesale.
    """
    from .seed_pages import PAGES

    wanted = set(refresh)
    unknown = wanted - set(PAGES)
    if unknown:
        raise SystemExit(f"No such page: {', '.join(sorted(unknown))}")

    for slug, (title, body) in PAGES.items():
        existing = db.scalar(select(Page).where(Page.slug == slug))
        if existing is None:
            db.add(Page(slug=slug, title=title, body=body.strip()))
        elif slug in wanted:
            existing.title = title
            existing.body = body.strip()
            print(f"  refreshed page: {slug}")
    db.commit()


def main(argv: Sequence[str] = ()) -> None:
    """Seed the catalogue.

    Arguments are taken from `argv` rather than from the command line, so a
    caller that runs the seed programmatically, as the test suite does, never
    picks up whatever flags its own process was started with.
    """
    parser = argparse.ArgumentParser(description="Seed the catalogue and page copy.")
    parser.add_argument(
        "--refresh-pages",
        nargs="+",
        default=[],
        metavar="SLUG",
        help=(
            "Rewrite these pages from seed_pages.py even though they already "
            "exist. Everything not named keeps whatever the console holds."
        ),
    )
    args = parser.parse_args(list(argv))

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_categories(db)
        seed_materials(db)
        rename_legacy_slugs(db)
        seed_products(db)
        seed_pages(db, refresh=args.refresh_pages)

        products = db.scalars(select(Product)).all()
        live = [p for p in products if p.status == "live"]
        publishable = [p for p in products if p.is_publishable]

        print("Catalogue synced to section 08 of the specification.")
        print(f"  categories:  {len(db.scalars(select(Category)).all())}")
        print(f"  materials:   {len(db.scalars(select(Material)).all())}")
        print(f"  pieces:      {len(products)}")
        print(f"  priced live: {len(live)}")
        print(f"  publishable: {len(publishable)}")
        print(f"  pages:       {len(db.scalars(select(Page)).all())}")
        print()
        if len(publishable) < len(live):
            print("Priced pieces are waiting on photography before they publish.")
            print("Upload a photograph per piece through /admin to release them.")


if __name__ == "__main__":
    main(sys.argv[1:])
