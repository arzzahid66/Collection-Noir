"""Enquiry notification, and the limits on the public enquiry route.

The enquiry form is the only transactional surface on the site and the only
unauthenticated route that writes. Both properties are tested here: that the
studio is told an enquiry arrived, and that telling them can never be what
makes the enquiry fail.
"""

from __future__ import annotations

import time

import httpx
import pytest
from sqlalchemy import select

from app import notify
from app.config import Settings
from app.db import SessionLocal
from app.models import Enquiry, Product
from app.ratelimit import RateLimiter, client_key

VALID = {
    "type": "general",
    "name": "Helena Vaughan",
    "email": "helena@example.com",
    "message": "I am interested in a console in a specific length.",
}


# ------------------------------------------------------------------ delivery


def test_an_enquiry_is_recorded_and_queued_for_notification(client, monkeypatch):
    sent: list[Enquiry] = []
    monkeypatch.setattr(
        "app.routers.enquiries.send_enquiry_notification",
        lambda enquiry: sent.append(enquiry),
    )

    response = client.post("/api/enquiries", json=VALID)

    assert response.status_code == 201
    assert len(sent) == 1
    assert sent[0].email == "helena@example.com"


def test_a_failing_mail_provider_does_not_fail_the_enquiry(client, monkeypatch):
    """The single most important property of this route.

    The row is committed before the notification is queued, so a provider
    outage costs a notification rather than a client's enquiry. If this
    regresses, enquiries are silently lost whenever the provider is down.
    """

    def explode(enquiry):
        raise RuntimeError("mail provider is down")

    monkeypatch.setattr("app.routers.enquiries.send_enquiry_notification", explode)

    # 201, and no exception escaping the background task into the server.
    response = client.post("/api/enquiries", json={**VALID, "email": "outage@example.com"})
    assert response.status_code == 201

    # And it really is in the database, not merely reported as created.
    session = SessionLocal()
    try:
        stored = session.scalar(select(Enquiry).where(Enquiry.email == "outage@example.com"))
        assert stored is not None
    finally:
        session.close()


def test_the_notification_is_a_no_op_without_a_provider(monkeypatch):
    monkeypatch.setattr(notify, "get_settings", lambda: Settings(resend_api_key=""))
    posted = []
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: posted.append(a))

    enquiry = Enquiry(id=1, type="general", name="A", email="a@example.com", message="m")
    notify.send_enquiry_notification(enquiry)

    assert posted == []


def test_the_notification_posts_to_the_provider_when_configured(monkeypatch):
    monkeypatch.setattr(
        notify,
        "get_settings",
        lambda: Settings(
            resend_api_key="re_test_key",
            enquiry_notify_to="studio@collectionnoir.com",
            enquiry_notify_from="Collection Noir <no-reply@collectionnoir.com>",
        ),
    )
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured.update(url=url, headers=headers, json=json)
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(notify.httpx, "post", fake_post)

    enquiry = Enquiry(
        id=7,
        type="general",
        name="Helena Vaughan",
        email="helena@example.com",
        message="Hello",
    )
    notify.send_enquiry_notification(enquiry)

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer re_test_key"
    assert captured["json"]["to"] == ["studio@collectionnoir.com"]
    assert "helena@example.com" in captured["json"]["text"]
    assert "Hello" in captured["json"]["text"]


def test_a_provider_error_is_swallowed(monkeypatch):
    """send_enquiry_notification must never raise: it runs in a background task."""
    monkeypatch.setattr(notify, "get_settings", lambda: Settings(resend_api_key="re_test_key"))

    def explode(*args, **kwargs):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(notify.httpx, "post", explode)

    enquiry = Enquiry(id=8, type="general", name="A", email="a@example.com", message="m")
    notify.send_enquiry_notification(enquiry)  # must not raise


# ------------------------------------------------------------------ subjects


def test_the_subject_separates_a_trade_registration():
    enquiry = Enquiry(
        id=1, type="trade", name="Studio Vaughan", email="a@example.com", message="m"
    )
    assert notify._subject(enquiry) == "Trade registration: Studio Vaughan"


def test_the_subject_separates_a_members_list_signup():
    """MailingListForm files a signup under a fixed name.

    It reads as a signup in the console, and should read as one in the inbox
    rather than as an enquiry from somebody called Members list.
    """
    enquiry = Enquiry(
        id=1, type="general", name="Members list", email="a@example.com", message="m"
    )
    assert notify._subject(enquiry) == "Members list signup"


def test_the_subject_names_the_piece_for_a_product_enquiry(db):
    product = db.scalar(select(Product).where(Product.slug == "roma"))
    enquiry = Enquiry(
        id=1,
        type="product",
        name="Helena",
        email="a@example.com",
        message="m",
        product=product,
    )
    assert notify._subject(enquiry) == "Enquiry: Roma"


# ------------------------------------------------------------- rate limiting


def test_a_burst_of_enquiries_is_refused(client, monkeypatch):
    monkeypatch.setattr("app.routers.enquiries.send_enquiry_notification", lambda e: None)

    accepted = 0
    for index in range(8):
        response = client.post(
            "/api/enquiries", json={**VALID, "email": f"burst{index}@example.com"}
        )
        if response.status_code == 201:
            accepted += 1
        else:
            assert response.status_code == 429
            assert "shortly" in response.json()["detail"]

    assert accepted == 5


def test_the_limit_is_per_address():
    limiter = RateLimiter(limit=2, window_seconds=3600)
    assert limiter.allow("1.1.1.1")
    assert limiter.allow("1.1.1.1")
    assert not limiter.allow("1.1.1.1")
    # A second visitor is unaffected by the first one's burst.
    assert limiter.allow("2.2.2.2")


# A tenth of a second of window against a third of a second of sleep. The
# margin is deliberately wide: Windows timer granularity is around 16ms and a
# loaded test run adds more, so a 10ms margin here failed intermittently while
# the limiter was behaving correctly.
_WINDOW = 0.1
_PAST_WINDOW = 0.35


def test_the_window_expires():
    limiter = RateLimiter(limit=1, window_seconds=_WINDOW)
    assert limiter.allow("1.1.1.1")
    assert not limiter.allow("1.1.1.1")

    time.sleep(_PAST_WINDOW)
    assert limiter.allow("1.1.1.1")


def test_buckets_do_not_accumulate_forever():
    """Memory is bounded by expiry, so a spray from many addresses cannot grow it."""
    limiter = RateLimiter(limit=1, window_seconds=_WINDOW)
    for index in range(50):
        limiter.allow(f"10.0.0.{index}")
    assert len(limiter._hits) == 50

    time.sleep(_PAST_WINDOW)
    limiter.allow("10.0.1.1")
    assert len(limiter._hits) == 1


def test_the_forwarded_header_identifies_the_caller():
    """Behind nginx the socket peer is always 127.0.0.1.

    Without reading the forwarded header, one visitor's burst would rate limit
    every other visitor on the site.
    """

    class Request:
        headers = {"x-forwarded-for": "203.0.113.9, 70.41.3.18"}
        client = None

    assert client_key(Request()) == "203.0.113.9"


# --------------------------------------------------------------- validation


@pytest.mark.parametrize(
    ("field", "value"),
    [("phone", "0" * 61), ("company", "c" * 201), ("message", "m" * 8001)],
)
def test_oversized_fields_are_refused_rather_than_reaching_the_column(client, field, value):
    """Each bound matches the column it lands in.

    SQLite truncates silently so the gap never showed locally; Postgres, which
    is what production runs, returns a 500 on a form a client just filled in.
    """
    response = client.post("/api/enquiries", json={**VALID, field: value})
    assert response.status_code == 422
