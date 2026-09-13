"use client";

import { createElement, useCallback, useState } from "react";

import { ApiError } from "@/lib/admin";

export interface PanelProps {
  onUnauthorised: () => void;
  /** Called after any edit to the draft, so the publish bar can recount. */
  onDraftChanged: () => void;
}

/**
 * Shared status handling for the console panels.
 *
 * A 401 that survived a refresh means the session has gone, so it is routed
 * back to the console to show the sign in screen rather than leaving a panel
 * showing data it can no longer save.
 */
export function usePanelStatus(onUnauthorised: () => void) {
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"info" | "error">("info");

  const report = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorised();
        return;
      }
      setTone("error");
      setStatus(error instanceof Error && error.message ? error.message : "Something did not save.");
    },
    [onUnauthorised],
  );

  const say = useCallback((message: string) => {
    setTone("info");
    setStatus(message);
  }, []);

  return { status, tone, report, say };
}

export function StatusLine({ status, tone }: { status: string; tone: "info" | "error" }) {
  if (!status) return null;
  // Written without JSX so this module can stay a .ts file.
  return createElement(
    "p",
    { className: "admin-status", "data-tone": tone, role: "status" },
    status,
  );
}

export const DRAFT_SAVED = "Saved to the draft. Publish to put it on the site.";

/** Formats a timestamp identically on the server and in the browser. */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
