"use client";

// PekuloNativeSelect — native `<select>` wrapper. The compound
// `PekuloSelect` (from `./PekuloSelect`) wraps `@tamagui/select` for fancy
// custom-popover use-cases. This primitive stays on the native control
// because form integration with TanStack Form + RSC is simpler and the
// accessibility behaviour ships free.

import type { CSSProperties, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloNativeSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> {
  controlSize?: "sm" | "md";
  invalid?: boolean;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloNativeSelectProps["controlSize"]>, number> = {
  sm: pekuloSpacing[8],
  md: pekuloSpacing[10],
};

const SIZE_PADDING_X: Record<NonNullable<PekuloNativeSelectProps["controlSize"]>, number> = {
  sm: pekuloSpacing[2],
  md: pekuloSpacing[3],
};

export const PekuloNativeSelect = forwardRef<HTMLSelectElement, PekuloNativeSelectProps>(
  function PekuloNativeSelect(
    { controlSize = "md", invalid = false, style, children, ...props },
    ref,
  ) {
    const merged: CSSProperties = {
      width: "100%",
      height: SIZE_HEIGHT[controlSize],
      backgroundColor: "var(--backgroundMuted)",
      color: "var(--color)",
      borderRadius: pekuloRadius.lg,
      padding: `0 ${SIZE_PADDING_X[controlSize]}px`,
      fontSize: pekuloFontSizes.bodySm,
      border: invalid ? "1px solid var(--danger)" : "none",
      outline: "none",
      fontFamily: "inherit",
      appearance: "none",
      WebkitAppearance: "none",
      cursor: "pointer",
      ...style,
    };
    return (
      <select data-slot="select" ref={ref} style={merged} {...props}>
        {children}
      </select>
    );
  },
);
