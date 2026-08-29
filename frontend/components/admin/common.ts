"use client";

import { useCallback, useState } from "react";

import { ApiError } from "@/lib/admin";

export interface PanelProps {
  onUnauthorised: () => void;
}

/**
 * Shared status handling for the console panels.
 *
 * A 401 is routed back to the console so it can show the sign in screen,
 * rather than leaving a panel showing stale data it can no longer save.
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
      setStatus(error instanceof ApiError ? error.message : "Something did not save.");
    },
    [onUnauthorised],
  );

  const say = useCallback((message: string) => {
    setTone("info");
    setStatus(message);
  }, []);

  return { status, tone, report, say };
}

export const PRODUCT_STATUSES = ["draft", "live", "paused"] as const;
export const IMAGE_ROLES = ["primary", "hero", "three_quarter", "detail"] as const;

export const ROLE_LABEL: Record<string, string> = {
  primary: "Primary (used on the grid)",
  hero: "Face-on hero",
  three_quarter: "Three quarter, elevated",
  detail: "Detail close-up",
};
