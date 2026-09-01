"""The public and administrative API surface.

Covers the publishing gate from section 09, the image handling promises from
section 07, and the fact that no purchase route exists at launch.
"""

from __future__ import annotations

from sqlalchemy import select

from app.models import Product

from .conftest import jpeg


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


# ------------------------------------------------------- the publishing gate


LAUNCH_PIECES = {
    "roma",
    "faro",
    "luna",
    "otis-coffee",
    "otis-oval",
    "ida",
    "orla",
    "esme",
    "otis-side",
    "ria",
    "alaia",
    "oria-side",
    "nova",
    "oria-plinth",
}


def test_the_gate_is_live_and_priced_and_nothing_else(client):
    """A piece is public when it is live AND priced. Both, or neither.

    Photography is deliberately not part of the gate. It used to be, and that
    single condition withheld the whole catalogue whenever images were
    unattached: fourteen approved, priced pieces vanished because nobody had
    linked a photograph. An unphotographed piece renders its frame as the
    letterbox mount with the empty-slot label, which is a designed state.
    """
    slugs = {p["slug"] for p in client.get("/api/products").json()}
    assert slugs == LAUNCH_PIECES
    # None of them is photographed in the seeded catalogue, which is the point.
    assert all(p["primary_image"] is None for p in client.get("/api/products").json())


def test_each_half_of_the_gate_is_load_bearing(client, admin, db):
    """Neither condition alone is enough.

    Kaia cannot demonstrate this on its own: it is paused *and* unpriced, so it
    would be excluded even if the rule were only half implemented. Roma is
    therefore failed one way at a time, so a regression that drops either
    condition is caught rather than masked.
    """
    roma = db.scalar(select(Product).where(Product.slug == "roma"))
    product_id = roma.id

    def is_listed() -> bool:
        db.expire_all()
        return "roma" in {p["slug"] for p in client.get("/api/products").json()}

    assert is_listed()

    # Priced, but not live.
    admin.patch(f"/api/admin/products/{product_id}", json={"status": "paused"})
    assert not is_listed()
    assert client.get("/api/products/dining-tables/roma").status_code == 404

    # Live again, but unpriced.
    admin.patch(
        f"/api/admin/products/{product_id}", json={"status": "live", "price_from": None}
    )
    assert not is_listed()
    assert client.get("/api/products/dining-tables/roma").status_code == 404

    # Both restored.
    admin.patch(f"/api/admin/products/{product_id}", json={"price_from": 6750})
    assert is_listed()
    assert client.get("/api/products/dining-tables/roma").status_code == 200


def test_kaia_is_absent_from_every_public_surface(client, db):
    """The standing regression case, section 08.

    Kaia is a complete record with no price, so it must not appear anywhere a
    visitor or a crawler can reach. Every public surface is checked rather than
    just the one that regressed last time.
    """
    kaia = db.scalar(select(Product).where(Product.slug == "kaia"))
    assert kaia is not None, "the record must exist; it is withheld, not deleted"
    assert kaia.price_from is None
    assert kaia.is_publishable is False

    # The full product list, and the list scoped to its own collection.
    assert "kaia" not in {p["slug"] for p in client.get("/api/products").json()}
    scoped = client.get("/api/products?category=bedside-tables").json()
    assert "kaia" not in {p["slug"] for p in scoped}

    # The collection's own product list, which the category page grid reads.
    category = client.get("/api/categories/bedside-tables")
    assert category.status_code == 200
    assert "kaia" not in {p["slug"] for p in category.json().get("products", [])}

    # The product route itself. A direct URL 404s rather than rendering.
    assert client.get("/api/products/bedside-tables/kaia").status_code == 404

    # The homepage hero photography.
    hero = client.get("/api/hero-images").json()
    assert all("kaia" not in (image.get("alt_text") or "").lower() for image in hero)

    # No other piece offers it as a pair, which would be a link into a 404.
    for product in client.get("/api/products").json():
        detail = client.get(
            f"/api/products/{product['category_slug']}/{product['slug']}"
        ).json()
        partner = detail.get("cross_link")
        assert partner is None or partner["slug"] != "kaia"


def test_kaia_publishes_the_moment_it_is_priced(client, admin, db):
    """The withholding is the price, not the record. Supplying one releases it,
    with no other edit and no redeploy."""
    kaia = db.scalar(select(Product).where(Product.slug == "kaia"))
    product_id = kaia.id

    admin.patch(
        f"/api/admin/products/{product_id}", json={"status": "live", "price_from": 2400}
    )
    db.expire_all()
    assert "kaia" in {p["slug"] for p in client.get("/api/products").json()}
    assert client.get("/api/products/bedside-tables/kaia").status_code == 200

    admin.patch(
        f"/api/admin/products/{product_id}",
        json={"status": "paused", "price_from": None},
    )
    db.expire_all()
    assert "kaia" not in {p["slug"] for p in client.get("/api/products").json()}


def test_a_price_edit_is_live_without_a_rebuild(client, admin, photographed, db):
    product_id = photographed["product_id"]
    admin.patch(f"/api/admin/products/{product_id}", json={"price_from": 7000})
    assert client.get("/api/products/dining-tables/roma").json()["price_from"] == 7000
    admin.patch(f"/api/admin/products/{product_id}", json={"price_from": 6750})
    assert client.get("/api/products/dining-tables/roma").json()["price_from"] == 6750


# ------------------------------------------------------------- product detail


def test_product_detail_carries_the_whole_section_08_record(client, photographed):
    body = client.get("/api/products/dining-tables/roma").json()
    assert body["name"] == "Roma"
    assert body["price_from"] == 6750
    assert body["pricing_status"] == "from"
    assert body["base"] == "Detachable pedestal"
    assert body["dimensions"] == "D1.3m (4-6 seats) / D1.6m (6-8 seats) / H75cm"
    assert body["lead_time_weeks"] == "12-16"
    assert body["bespoke_box_type"] == "standard"
    assert body["spec_sheet"] == "roma-spec-sheet.pdf"
    assert body["care_guide"] == "collection-noir-care-guide.pdf"
    assert body["purchasable"] is False
    assert body["aspect_ratio"] == "3-2"


def test_swatch_colours_reach_the_frontend(client, photographed):
    body = client.get("/api/products/dining-tables/roma").json()
    swatches = [m["material"]["swatch_hex"] for m in body["materials"]]
    assert all(swatches), "every finish needs a swatch for the product page row"


def test_category_ratio_travels_with_the_product(client, photographed):
    """The frontend picks its frame class from this field, so a product must
    never be asked to guess its ratio."""
    body = client.get("/api/products?category=dining-tables").json()
    assert all(p["aspect_ratio"] == "3-2" for p in body)


# ------------------------------------------------------------------ pairings


def test_pairing_resolves_to_the_partner(client, admin, db):
    """Both halves of a pair need photography before either can be linked, so
    this attaches to both and checks the reference points the right way."""
    coffee = db.scalar(select(Product).where(Product.slug == "otis-coffee"))
    side = db.scalar(select(Product).where(Product.slug == "otis-side"))

    created = []
    for product, size in ((coffee, (3000, 2000)), (side, (1600, 2000))):
        data = jpeg(*size)
        upload = admin.post(
            "/api/admin/images",
            files={"file": (f"{product.slug}.jpg", data, "image/jpeg")},
        )
        assert upload.status_code == 201, upload.text
        image_id = upload.json()["id"]
        created.append(image_id)
        attach = admin.post(
            f"/api/admin/products/{product.id}/images",
            json={"image_id": image_id, "role": "primary", "sort_order": 0},
        )
        assert attach.status_code in (200, 201), attach.text

    body = client.get("/api/products/coffee-tables/otis-coffee").json()
    assert body["cross_link"]["slug"] == "otis-side"
    assert body["cross_link"]["category_slug"] == "side-tables"
    assert body["cross_link"]["subtitle"] == "Side table"

    reverse = client.get("/api/products/side-tables/otis-side").json()
    assert reverse["cross_link"]["slug"] == "otis-coffee"
    assert reverse["cross_link"]["category_slug"] == "coffee-tables"

    for image_id in created:
        admin.delete(f"/api/admin/images/{image_id}")


def test_pairing_is_dropped_when_the_partner_is_unpublished(client, admin, db):
    """A cross reference must never offer a link that would 404.

    Both halves of this pair are published in the seeded catalogue, so the
    partner is withdrawn for the duration of the check rather than assumed to
    be unpublished. Asserting against a piece that happens to be hidden for an
    unrelated reason would stop testing this rule the moment that reason
    changed, which is exactly what happened when the gate required photography.
    """
    oria = db.scalar(select(Product).where(Product.slug == "oria-side"))
    assert oria.cross_link_slug == "oria-plinth"

    partner = db.scalar(select(Product).where(Product.slug == "oria-plinth"))
    assert partner.is_publishable is True

    # With the partner published, the link is offered.
    detail = client.get("/api/products/side-tables/oria-side").json()
    assert detail["cross_link"]["slug"] == "oria-plinth"

    # Withdraw the partner; the reference has to disappear with it.
    admin.patch(f"/api/admin/products/{partner.id}", json={"price_from": None})
    db.expire_all()
    detail = client.get("/api/products/side-tables/oria-side").json()
    assert detail["cross_link"] is None
    assert detail["cross_link_slug"] == "oria-plinth", "the editorial pairing is kept"

    admin.patch(f"/api/admin/products/{partner.id}", json={"price_from": 3730})
    db.expire_all()


# -------------------------------------------------------------------- images


def test_image_bytes_round_trip_unchanged(client, admin):
    """Section 07: nothing crops, resizes or re-encodes a supplied photograph."""
    original = jpeg(2000, 2000, (156, 130, 114))
    upload = admin.post(
        "/api/admin/images", files={"file": ("square.jpg", original, "image/jpeg")}
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    # The natural dimensions are recorded but the pixels are untouched.
    assert (body["width"], body["height"]) == (2000, 2000)
    assert body["byte_size"] == len(original)

    served = client.get(body["url"])
    assert served.status_code == 200
    assert served.content == original, "image bytes were altered in transit"

    admin.delete(f"/api/admin/images/{body['id']}")


def test_image_rejects_a_non_image(admin):
    response = admin.post(
        "/api/admin/images", files={"file": ("notes.txt", b"not an image", "text/plain")}
    )
    assert response.status_code == 415


def _attach_hero(admin, product_id: int) -> int:
    data = jpeg(2400, 1200)
    upload = admin.post(
        "/api/admin/images", files={"file": ("hero.jpg", data, "image/jpeg")}
    )
    assert upload.status_code == 201, upload.text
    image_id = upload.json()["id"]
    attach = admin.post(
        f"/api/admin/products/{product_id}/images",
        json={"image_id": image_id, "role": "hero", "sort_order": 0},
    )
    assert attach.status_code in (200, 201), attach.text
    return image_id


def test_hero_images_are_data_driven(client, admin, photographed):
    """The homepage hero reads its frames from images tagged `hero`, so the
    photograph can be changed in the console without touching template code."""
    assert client.get("/api/hero-images").json() == []

    image_id = _attach_hero(admin, photographed["product_id"])
    try:
        frames = client.get("/api/hero-images").json()
        assert [f["id"] for f in frames] == [image_id]
        assert frames[0]["url"] == f"/api/images/{image_id}"
    finally:
        admin.delete(f"/api/admin/images/{image_id}")

    assert client.get("/api/hero-images").json() == []


def test_a_paused_piece_never_lends_its_photography_to_the_hero(client, admin, db):
    """Kaia is held off the site, so nothing of it reaches the homepage either.

    This is the invariant that matters on the hero: photography belonging to an
    unreleased piece must not appear anywhere, not just in its own grid.
    """
    kaia = db.scalar(select(Product).where(Product.slug == "kaia"))
    image_id = _attach_hero(admin, kaia.id)
    try:
        assert client.get("/api/hero-images").json() == []
    finally:
        admin.delete(f"/api/admin/images/{image_id}")


# ------------------------------------------------------------------ enquiries


def test_an_enquiry_can_be_sent(client):
    response = client.post(
        "/api/enquiries",
        json={
            "type": "general",
            "name": "Test Sender",
            "email": "sender@example.com",
            "message": "Location: London, United Kingdom\n\nEnquiring about the Roma.",
        },
    )
    assert response.status_code in (200, 201), response.text


def test_an_enquiry_needs_a_valid_email(client):
    response = client.post(
        "/api/enquiries",
        json={"type": "general", "name": "Test", "email": "not-an-email", "message": "Hello"},
    )
    assert response.status_code == 422


def test_a_trade_registration_carries_the_studio_name(client, admin):
    response = client.post(
        "/api/enquiries",
        json={
            "type": "trade",
            "name": "Test Designer",
            "email": "studio@example.com",
            "company": "Test Studio",
            "message": "Website: example.com\nCompany reg number: 12345678",
        },
    )
    assert response.status_code in (200, 201), response.text
    inbox = admin.get("/api/admin/enquiries").json()
    trade = [e for e in inbox if e["type"] == "trade"]
    assert trade and trade[0]["company"] == "Test Studio"


# --------------------------------------------------------------- no purchase


def test_ordering_a_launch_piece_is_refused(client, db):
    """Section 02: nothing is held in stock, so cart and basket framing is
    inaccurate as well as off-brand.

    No launch piece is purchasable, so an attempt to order one is turned away
    and pointed at the enquiry route instead. The 501 branch behind it is only
    reachable once a piece is marked purchasable, which none is.
    """
    roma = db.scalar(select(Product).where(Product.slug == "roma"))
    response = client.post("/api/orders", json={"product_id": roma.id, "quantity": 1})
    assert response.status_code == 400
    assert "enquire" in response.json()["detail"].lower()


def test_no_piece_can_actually_be_ordered(client, admin, db):
    """Even with the purchasable flag switched on, there is no cart, no payment
    provider and no completed order. The route answers 501 and records nothing.
    copy-lint-ok"""
    roma = db.scalar(select(Product).where(Product.slug == "roma"))
    admin.patch(f"/api/admin/products/{roma.id}", json={"purchasable": True})
    try:
        response = client.post("/api/orders", json={"product_id": roma.id, "quantity": 1})
        assert response.status_code == 501
    finally:
        admin.patch(f"/api/admin/products/{roma.id}", json={"purchasable": False})

    # And it goes back off, so no piece ships with it enabled.
    db.expire_all()
    assert db.scalar(select(Product).where(Product.slug == "roma")).purchasable is False


# -------------------------------------------------------------------- admin


def test_admin_routes_require_a_session(client):
    for path in (
        "/api/admin/products",
        "/api/admin/images",
        "/api/admin/enquiries",
        "/api/admin/categories",
    ):
        assert client.get(path).status_code in (401, 403), path


def test_admin_rejects_a_wrong_password(client):
    response = client.post(
        "/api/admin/login",
        json={"email": "tests@collectionnoir.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_admin_login_does_not_confirm_the_address(client):
    """One message for both a wrong address and a wrong password, so the
    response does not reveal which address is the administrator's."""
    wrong_password = client.post(
        "/api/admin/login",
        json={"email": "tests@collectionnoir.com", "password": "wrong"},
    )
    wrong_email = client.post(
        "/api/admin/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert wrong_password.json() == wrong_email.json()


def test_the_console_can_edit_the_whole_section_08_record(admin, photographed, client):
    """Section 04: content is edited in the console, never in template code.

    Every field the product page renders has to be reachable from the console,
    including the ones added for figure 3. A field the page shows but the
    console cannot change is a field that needs a developer, which is what the
    specification rules out.
    """
    product_id = photographed["product_id"]
    original = admin.get(f"/api/admin/products/{product_id}").json()

    edits = {
        "base": "Test base note",
        "bespoke_box_type": "size_only",
        "cross_link_slug": "faro",
        "dimensions": "D1.0m / H70cm",
        "lead_time_weeks": "20-24",
    }
    response = admin.patch(f"/api/admin/products/{product_id}", json=edits)
    assert response.status_code == 200, response.text

    public = client.get("/api/products/dining-tables/roma").json()
    for field, value in edits.items():
        assert public[field] == value, field

    # Put it back, so the catalogue still matches section 08 afterwards.
    admin.patch(
        f"/api/admin/products/{product_id}",
        json={key: original[key] for key in edits},
    )
    restored = client.get("/api/products/dining-tables/roma").json()
    assert restored["base"] == "Detachable pedestal"
    assert restored["bespoke_box_type"] == "standard"
    assert restored["cross_link_slug"] is None


def test_the_console_can_edit_a_category_bespoke_prompt(admin, client, db):
    """The prompt in figures 6 and 8 is copy, so it lives in the console."""
    from app.models import Category

    category = db.scalar(select(Category).where(Category.slug == "plinths"))
    original = category.bespoke_prompt

    response = admin.patch(
        f"/api/admin/categories/{category.id}",
        json={"bespoke_prompt": "Test prompt"},
    )
    assert response.status_code == 200, response.text

    served = client.get("/api/categories/plinths").json()
    assert served["bespoke_prompt"] == "Test prompt"

    admin.patch(
        f"/api/admin/categories/{category.id}", json={"bespoke_prompt": original}
    )
    assert client.get("/api/categories/plinths").json()["bespoke_prompt"] == original


def test_the_console_can_edit_a_material_swatch(admin, client, photographed, db):
    """The swatch row on a product page reads this, so it has to be editable."""
    from app.models import Material

    material = db.scalar(select(Material).where(Material.slug == "nero-marquina"))
    original = material.swatch_hex

    response = admin.patch(
        f"/api/admin/materials/{material.id}", json={"swatch_hex": "#123456"}
    )
    assert response.status_code == 200, response.text

    product = client.get("/api/products/dining-tables/roma").json()
    shown = next(m for m in product["materials"] if m["is_default"])
    assert shown["material"]["swatch_hex"] == "#123456"

    admin.patch(f"/api/admin/materials/{material.id}", json={"swatch_hex": original})


def test_admin_can_read_the_catalogue(admin):
    body = admin.get("/api/admin/products").json()
    assert len(body) == 15, "all fifteen records, including paused Kaia"


def test_admin_sees_paused_pieces(admin):
    slugs = [p["slug"] for p in admin.get("/api/admin/products").json()]
    assert "kaia" in slugs


# --------------------------------------------------------------------- pages


def test_standing_page_copy_is_served(client):
    for slug in (
        "home-intro",
        "home-bespoke",
        "atelier",
        "atelier-founder",
        "atelier-designers",
        "atelier-press",
        "trade",
        "enquire-intro",
        "care",
        "legal-terms",
        "legal-shipping",
        "legal-returns",
        "legal-privacy",
    ):
        response = client.get(f"/api/pages/{slug}")
        assert response.status_code == 200, slug
        assert response.json()["body"].strip(), slug


def test_page_titles_match_the_mockups(client):
    assert client.get("/api/pages/enquire-intro").json()["title"] == "Begin a conversation"
    assert client.get("/api/pages/trade").json()["title"] == "Register for trade access"


def test_categories_endpoint_hides_hidden_categories(client):
    slugs = [c["slug"] for c in client.get("/api/categories").json()]
    assert "chest-of-drawers" not in slugs
    assert len(slugs) == 6
