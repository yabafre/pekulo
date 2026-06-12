"use client";

// apps/web/src/lib/segment-error.tsx
// Shared fallback rendered by every route-segment `error.tsx`. Wraps the
// segment subtree in PekuloErrorBoundary, shows a generic French message
// (never the raw `error.message`) and a "Réessayer" button wired to Next's
// `reset()`. Styled with DS tokens on the dark TR background (no hardcoded
// colours). The technical detail is logged to the console for debugging.

import { useEffect } from "react";
import { PekuloErrorBoundary, pekuloRadius, pekuloSpacing } from "@pekulo/ui";
import { USER_ERROR_MESSAGE } from "./user-error-message";

export interface SegmentErrorProps {
  /** The error forwarded by Next.js to the segment `error.tsx`. */
  error: Error & { digest?: string };
  /** Next.js recovery callback — re-renders the segment subtree. */
  reset: () => void;
  /** French message describing which screen failed (e.g. "ce portefeuille"). */
  message?: string;
  /** Console label used to scope the logged technical detail. */
  context?: string;
}

export function SegmentError({ error, reset, message, context }: SegmentErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(context ? `[${context}]` : "[segment-error]", error);
  }, [error, context]);

  return (
    <PekuloErrorBoundary>
      <div
        role="alert"
        style={{
          minHeight: "60dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: pekuloSpacing[3],
          padding: pekuloSpacing[6],
          backgroundColor: "var(--background)",
          color: "var(--color)",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>{message ?? USER_ERROR_MESSAGE}</p>
        {message ? (
          <p style={{ margin: 0, color: "var(--colorTertiary)" }}>{USER_ERROR_MESSAGE}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 40,
            padding: "0 16px",
            borderRadius: pekuloRadius.full,
            backgroundColor: "var(--backgroundMuted)",
            color: "var(--color)",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Réessayer
        </button>
      </div>
    </PekuloErrorBoundary>
  );
}
