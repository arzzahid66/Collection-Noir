"""Enquiry notification.

Enquiries were written to the database and nowhere else, which meant nobody
was told one had arrived. On a site whose only transactional surface is the
enquiry form, that is the difference between a lead and a row.

Three things this module is careful about:

- **It never fails the enquiry.** The client's submission is recorded before
  this runs, and it runs in a background task. A mail outage, a revoked API
  key or a network stall must not turn a successful enquiry into an error
  page, because the enquiry is already safely stored.
- **It is optional.** With no `RESEND_API_KEY` it logs and returns. The test
  suite and a local clone therefore need no credentials and send no mail.
- **It is not Resend specific in shape.** The provider is one function. Brevo,
  Postmark or plain SMTP would replace `_send_via_resend` and nothing else.

The three enquiry types share one table, with trade and members list details
flattened into `message` by the frontend forms. The subject line separates
them again so the studio inbox can be triaged without opening the console.
"""

from __future__ import annotations

import logging

import httpx

from .config import get_settings
from .models import Enquiry

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"

_SUBJECTS = {
    "trade": "Trade registration",
    "product": "Enquiry",
    "general": "Enquiry",
}


def _subject(enquiry: Enquiry) -> str:
    # The members list signup is a general enquiry with a fixed name, set by
    # MailingListForm. It reads as a signup in the console and should read as
    # one in the inbox too rather than as a nameless enquiry.
    if enquiry.name == "Members list":
        return "Members list signup"

    label = _SUBJECTS.get(enquiry.type, "Enquiry")
    if enquiry.type == "product" and enquiry.product is not None:
        return f"{label}: {enquiry.product.name}"
    return f"{label}: {enquiry.name}"


def _body(enquiry: Enquiry) -> str:
    lines = [
        f"Type:    {enquiry.type}",
        f"Name:    {enquiry.name}",
        f"Email:   {enquiry.email}",
    ]
    if enquiry.phone:
        lines.append(f"Phone:   {enquiry.phone}")
    if enquiry.company:
        lines.append(f"Company: {enquiry.company}")
    if enquiry.product is not None:
        lines.append(f"Piece:   {enquiry.product.name}")
    lines.append("")
    lines.append(enquiry.message)
    lines.append("")
    lines.append(f"Recorded as enquiry #{enquiry.id}.")
    return "\n".join(lines)


def _send_via_resend(api_key: str, sender: str, recipient: str, subject: str, body: str) -> None:
    response = httpx.post(
        _RESEND_ENDPOINT,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": sender, "to": [recipient], "subject": subject, "text": body},
        timeout=10.0,
    )
    response.raise_for_status()


def send_enquiry_notification(enquiry: Enquiry) -> None:
    """Tell the studio an enquiry arrived. Never raises."""
    settings = get_settings()

    if not settings.resend_api_key:
        logger.info(
            "Enquiry #%s recorded; no mail provider configured so no notification sent.",
            enquiry.id,
        )
        return

    try:
        _send_via_resend(
            settings.resend_api_key,
            settings.enquiry_notify_from,
            settings.enquiry_notify_to,
            _subject(enquiry),
            _body(enquiry),
        )
    except Exception:  # noqa: BLE001 - see the module docstring
        # exception() so the traceback reaches the log. The enquiry is already
        # committed and is visible in the console, so this is recoverable by a
        # human reading the inbox rather than something to retry blindly.
        logger.exception("Could not send the notification for enquiry #%s", enquiry.id)
    else:
        logger.info("Notification sent for enquiry #%s", enquiry.id)
