"use client";

import type { CSSProperties } from "react";
import { View, styled } from "@pekulo/ui/client";
import { pekuloRadius } from "@pekulo/ui";

// Shared form atoms for the (cap) route group's two write-paths
// (`add-milestone-form`, `compass-edit-form`). Tamagui v2's `styled()`
// rejects raw HTML element strings, so the input/submit live as plain
// elements with token-backed inline styles instead of `styled("input")`.

export const FormField = styled(View, {
  flexDirection: "column",
  gap: "$2",
  paddingVertical: "$2",
});

export const formInputStyle: CSSProperties = {
  backgroundColor: "var(--backgroundMuted)",
  color: "var(--color)",
  borderRadius: pekuloRadius.lg,
  padding: "8px 12px",
  fontSize: 14,
  border: "none",
  outline: "none",
};

export const formSubmitStyle = (disabled: boolean): CSSProperties => ({
  // `alignSelf` keeps the pill compact (max-content width) inside a
  // flex-column form whose default `align-items: stretch` would otherwise
  // force the button to span the full row.
  alignSelf: "flex-start",
  backgroundColor: "var(--color)",
  color: "var(--colorOnAccent)",
  height: 44,
  padding: "0 24px",
  borderRadius: pekuloRadius.full,
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontSize: 14,
  fontWeight: 500,
  marginTop: 8,
});
