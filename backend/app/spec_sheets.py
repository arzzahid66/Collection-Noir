"""Per-product PDF specification sheets, section 04.

Each piece gets a downloadable sheet carrying its dimensions, materials, care
notes and lead time. Sheets are rendered from the same product records the
public pages are built from, so a price or a dimension corrected in the console
reaches the sheet on the next run rather than drifting away from the site.

Filenames are slug based and land in a `/spec-sheets/` directory, per the
specification: `roma-spec-sheet.pdf`, `otis-coffee-spec-sheet.pdf`. The value
stored on `Product.spec_sheet` is the filename the product page links to, so
the two cannot disagree.

A single shared care guide is written alongside them, which is what the product
page in figure 3 links to from its second download row.

On the rendering library
------------------------
The specification records WeasyPrint and Jinja2 as the original pipeline and
says explicitly that it is not mandatory, so long as content comes from
structured data. WeasyPrint needs GTK system libraries (libgobject and friends)
that are not present on a plain Windows install, which makes it a poor
dependency for a handoff where the next person may be on any platform. This
module uses reportlab instead: pure Python, no system libraries, identical
output everywhere.

Typography
----------
Cormorant Garamond is the only typeface on this brand. It carries body copy and
micro labels as well as headings, and there is no secondary face: section 1.1
of the frontend correction brief removed the sans the earlier build set body
copy in, and that rule holds here too. Cormorant is not bundled with reportlab,
so if the real font files are dropped into `backend/assets/fonts/` they are
picked up and embedded; otherwise the sheet falls back to Times, the nearest
serif reportlab ships, and the substitution is logged so it is visible rather
than silent. The fallback is never a sans.

Run with:  python -m app.spec_sheets
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from .db import SessionLocal
from .models import Product, ProductImage, ProductMaterial

# Palette, section 0 of the frontend correction brief. Held here as well as in
# tokens.css because a PDF is not styled by the site stylesheet, and a sheet in
# the wrong greys would not read as the same brand. Kept in step with
# tokens.css by hand: Ink, Clay and the hairline all moved in this revision.
INK = HexColor("#1C1714")
BARK = HexColor("#9C8272")
CLAY = HexColor("#C4AD97")
IVORY = HexColor("#FAF8F3")
HAIRLINE = HexColor("#EAE4D9")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 22 * mm

_FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

# Built-in fallbacks. Times is the nearest serif reportlab ships to Cormorant
# Garamond, and it is the same fallback the site stylesheet names. Body copy
# falls back to the serif too: there is no sans on this brand.
DISPLAY = "Times-Roman"
DISPLAY_ITALIC = "Times-Italic"
BODY = "Times-Roman"

_substitutions: list[str] = []


def _register_fonts() -> None:
    """Embed the brand faces when the files are present.

    TODO(client): supply Cormorant Garamond Light and Light Italic as TTF files
    in backend/assets/fonts/ so the sheet sets in the brand face rather than in
    the fallback. Two files, not three: the sheet sets body copy in the same
    face as its headings, because the brand has one typeface.
    """
    global DISPLAY, DISPLAY_ITALIC, BODY

    wanted = [
        ("CormorantGaramond-Light.ttf", "Cormorant-Light", "display"),
        ("CormorantGaramond-LightItalic.ttf", "Cormorant-LightItalic", "display_italic"),
    ]

    for filename, name, role in wanted:
        path = _FONT_DIR / filename
        if not path.exists():
            _substitutions.append(filename)
            continue
        try:
            pdfmetrics.registerFont(TTFont(name, str(path)))
        except Exception:  # noqa: BLE001 - a bad font file is a supply problem
            _substitutions.append(f"{filename} (could not be read)")
            continue
        if role == "display":
            DISPLAY = name
            # One typeface: body copy sets in the same face as the headings.
            BODY = name
        elif role == "display_italic":
            DISPLAY_ITALIC = name


class Sheet:
    """A single specification sheet.

    Thin wrapper over the canvas that tracks the vertical cursor, so each block
    below reads as "put this here, move down" rather than arithmetic on
    absolute coordinates.
    """

    def __init__(self, path: Path, title: str) -> None:
        self.canvas = canvas.Canvas(str(path), pagesize=A4)
        self.canvas.setTitle(title)
        self.canvas.setAuthor("Collection Noir")
        self.y = PAGE_HEIGHT - MARGIN
        self._ground()

    def _ground(self) -> None:
        self.canvas.setFillColor(IVORY)
        self.canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    def space(self, amount: float) -> None:
        self.y -= amount

    def eyebrow(self, text: str) -> None:
        self.canvas.setFont(BODY, 6.5)
        self.canvas.setFillColor(CLAY)
        self.canvas.drawString(MARGIN, self.y, _track(text.upper()))
        self.y -= 16

    def heading(self, text: str, size: float = 26) -> None:
        self.canvas.setFont(DISPLAY, size)
        self.canvas.setFillColor(INK)
        self.canvas.drawString(MARGIN, self.y, text)
        self.y -= size * 0.95

    def italic(self, text: str, size: float = 11) -> None:
        self.canvas.setFont(DISPLAY_ITALIC, size)
        self.canvas.setFillColor(BARK)
        self.canvas.drawString(MARGIN, self.y, text)
        self.y -= size * 1.5

    def body(self, text: str, size: float = 8.5, colour=INK, width: float | None = None) -> None:
        """Draw wrapped body copy."""
        limit = width if width is not None else PAGE_WIDTH - (2 * MARGIN)
        self.canvas.setFillColor(colour)
        self.canvas.setFont(BODY, size)
        for line in _wrap(text, BODY, size, limit):
            self.canvas.drawString(MARGIN, self.y, line)
            self.y -= size * 1.75

    def rule(self) -> None:
        """A structural rule between blocks, not a decorative device."""
        self.canvas.setStrokeColor(HAIRLINE)
        self.canvas.setLineWidth(0.5)
        self.canvas.line(MARGIN, self.y, PAGE_WIDTH - MARGIN, self.y)
        self.y -= 14

    def pair(self, label: str, value: str) -> None:
        self.canvas.setFont(BODY, 6.5)
        self.canvas.setFillColor(CLAY)
        self.canvas.drawString(MARGIN, self.y, _track(label.upper()))
        self.y -= 11
        self.canvas.setFont(BODY, 9)
        self.canvas.setFillColor(INK)
        for line in _wrap(value, BODY, 9, PAGE_WIDTH - (2 * MARGIN)):
            self.canvas.drawString(MARGIN, self.y, line)
            self.y -= 13
        self.y -= 5

    def footer(self, lines: list[str]) -> None:
        self.canvas.setFont(BODY, 6.5)
        self.canvas.setFillColor(CLAY)
        y = MARGIN
        for line in reversed(lines):
            self.canvas.drawString(MARGIN, y, _track(line.upper()))
            y += 11

    def save(self) -> None:
        self.canvas.showPage()
        self.canvas.save()


def _track(text: str, amount: str = " ") -> str:
    """Approximate the wide letter spacing the brand uses on small caps.

    reportlab has no letter-spacing property, so the tracking is written into
    the string. Only used on short uppercase labels, never on body copy.
    """
    return amount.join(text)


def _wrap(text: str, font: str, size: float, limit: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= limit:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


CARE_NOTES = [
    "Every piece is made to order and finished by hand. Veining and ground "
    "colour vary block to block, so the piece delivered will differ from the "
    "photograph shown.",
    "Wipe with a soft cloth and warm water. Blot spills rather than wiping "
    "them across the surface.",
    "Avoid acidic liquids on marble and travertine, including citrus, wine and "
    "vinegar. These etch the surface rather than staining it, and etching "
    "cannot be cleaned off.",
    "Use mats under anything hot or wet. Do not use household cleaners, "
    "descalers or abrasive pads.",
    "Timber is hand oiled and can be re-oiled. Hand patinated bronze will "
    "continue to move for the first year in a room, then settle.",
]


def render_product(product: Product, directory: Path) -> str:
    """Write one sheet and return its filename."""
    filename = f"{product.slug}-spec-sheet.pdf"
    sheet = Sheet(directory / filename, f"{product.name} specification sheet")

    sheet.eyebrow("Collection Noir")
    sheet.space(6)
    sheet.heading(product.name)
    if product.subtitle:
        sheet.italic(product.subtitle)
    sheet.space(8)
    sheet.rule()

    if product.price_from is not None:
        sheet.pair("Starting from", f"£{product.price_from:,}")

    if product.dimensions:
        for part in [p.strip() for p in product.dimensions.split("/") if p.strip()]:
            sheet.pair("Dimensions", part)

    if product.base:
        sheet.pair("Base", product.base)

    if product.lead_time_weeks:
        sheet.pair("Lead time", f"{product.lead_time_weeks} weeks")

    sheet.pair("Making", "Made to order. Nothing is held in stock.")

    materials = sorted(product.materials, key=lambda link: link.sort_order)
    if materials:
        default = next((m for m in materials if m.is_default), materials[0])
        sheet.pair("Material shown", default.material.name)
        provenance = ", ".join(
            part
            for part in (
                default.material.quarry,
                default.material.region,
                default.material.origin,
            )
            if part
        )
        if provenance:
            sheet.pair("Provenance", provenance)
        if default.material.finish:
            sheet.pair("Finish", default.material.finish)

        alternates = [m.material.name for m in materials if m.id != default.id]
        if alternates:
            label = (
                "Fixed pairing"
                if product.bespoke_box_type == "size_only"
                else "Also available in"
            )
            sheet.pair(label, ", ".join(alternates))

    if product.base_description:
        sheet.space(4)
        sheet.rule()
        sheet.eyebrow("The piece")
        sheet.body(product.base_description)

    sheet.space(10)
    sheet.rule()
    sheet.eyebrow("Care")
    for note in CARE_NOTES[:3]:
        sheet.body(note, colour=BARK)
        sheet.space(4)

    sheet.footer(
        [
            "Worlds End Studios, 132-134 Lots Road, Unit 124, London SW10 0RJ",
            "London Design. Italian Craft.  collectionnoir.com",
        ]
    )
    sheet.save()
    return filename


def render_care_guide(directory: Path, filename: str) -> str:
    sheet = Sheet(directory / filename, "Caring for your piece")
    sheet.eyebrow("Collection Noir")
    sheet.space(6)
    sheet.heading("Caring for your piece")
    sheet.italic("Marble, timber and hand worked metal")
    sheet.space(10)
    sheet.rule()

    for note in CARE_NOTES:
        sheet.body(note)
        sheet.space(8)

    sheet.space(6)
    sheet.rule()
    sheet.eyebrow("Questions")
    sheet.body(
        "Write to info@collectionnoir.com and we will advise on the specific "
        "material your piece is made from.",
        colour=BARK,
    )

    sheet.footer(
        [
            "Worlds End Studios, 132-134 Lots Road, Unit 124, London SW10 0RJ",
            "London Design. Italian Craft.  collectionnoir.com",
        ]
    )
    sheet.save()
    return filename


def _load(db: Session) -> list[Product]:
    stmt = (
        select(Product)
        .options(
            joinedload(Product.category),
            selectinload(Product.materials).selectinload(ProductMaterial.material),
            selectinload(Product.images).selectinload(ProductImage.image),
        )
        .order_by(Product.sort_order, Product.name)
    )
    return list(db.scalars(stmt).unique().all())


def generate(output: Path | None = None) -> int:
    """Render a sheet for every piece, plus the shared care guide.

    Sheets are written for paused pieces too. Kaia has no confirmed price, so
    its sheet simply omits the price row: the document is ready the moment the
    piece is released rather than being a second job at that point.
    """
    _register_fonts()

    # Written into the frontend's public directory, so the files are served at
    # /spec-sheets/ alongside the site with no extra route or host.
    root = Path(__file__).resolve().parent.parent.parent
    spec_dir = output or (root / "frontend" / "public" / "spec-sheets")
    care_dir = root / "frontend" / "public" / "care-guides"
    spec_dir.mkdir(parents=True, exist_ok=True)
    care_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    with SessionLocal() as db:
        products = _load(db)
        for product in products:
            filename = render_product(product, spec_dir)
            # Keep the record pointing at the file that was actually written.
            product.spec_sheet = filename
            written += 1
        db.commit()

    care = render_care_guide(care_dir, "collection-noir-care-guide.pdf")

    print(f"Specification sheets written to {spec_dir}")
    print(f"  sheets: {written}")
    print(f"  care guide: {care}")
    if _substitutions:
        print()
        print("Brand fonts not supplied, fallback faces used for:")
        for name in _substitutions:
            print(f"  {name}")
        print(f"Drop the files into {_FONT_DIR} to embed the real faces.")
    return written


if __name__ == "__main__":
    generate()
