"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_NAME = "cn_cookie_consent";

function readConsent(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeConsent(value: "accepted" | "declined") {
  const year = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${year}; samesite=lax`;
}

/**
 * Cookie consent, per the Privacy and Electronic Communications Regulations.
 *
 * Declining is as easy as accepting, which the regulations require. Nothing
 * non-essential is set until a choice is made, and at present the site sets no
 * analytics or advertising cookies at all, so this records a preference rather
 * than gating anything.
 */
export function CookieBanner() {
  const [choice, setChoice] = useState<string | null>("pending");

  useEffect(() => {
    setChoice(readConsent());
  }, []);

  if (choice !== null) return null;

  const decide = (value: "accepted" | "declined") => {
    writeConsent(value);
    setChoice(value);
  };

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie choices">
      <p>
        This site sets one cookie to remember this choice, and one to sign a
        member of the atelier into the administration area. No advertising or
        tracking cookies are used. Read the{" "}
        <Link href="/legal/cookies">Cookie Policy</Link>.
      </p>
      <div className="cookie-banner__actions">
        <button type="button" onClick={() => decide("accepted")}>
          Accept
        </button>
        <button type="button" onClick={() => decide("declined")}>
          Decline
        </button>
      </div>
    </div>
  );
}
