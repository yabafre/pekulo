"use client";

// PekuloButton — generic CTA primitive, shadcn-`Button` parity for the
// Pekulo DS. Renders as a native `<button>` so RSC + native form
// integration ship free; styling routes through Pekulo tokens
// (pekuloFontSizes / pekuloSpacing / pekuloRadius / theme CSS vars) so a
// future theme retune propagates. Interaction states (hover/active/
// focus-visible) ride on plain CSS pseudo-classes injected next to the
// component (mirrors PekuloSubmitButton's pattern — keeps the primitive
// RSC-safe without a CSS module dep).
//
// asChild (Radix Slot) deliberately omitted at V1 — none of the current
// consumers compose Button into a Link/a slot, and pulling in
// `@radix-ui/react-slot` for a single feature isn't worth the surface
// area. Restore by wrapping with Slot if needed.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";
import { PekuloSpinner } from "./PekuloSpinner";

export type PekuloButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

export type PekuloButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export interface PekuloButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PekuloButtonVariant;
  size?: PekuloButtonSize;
  /** Spinner-during-action indicator. Also sets aria-busy + disabled. */
  loading?: boolean;
  /** Label rendered next to the spinner during loading (default: children). */
  loadingLabel?: ReactNode;
}

const PEKULO_BUTTON_CSS = `
.pekulo-btn {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: opacity 150ms ease-out, transform 100ms ease-out, background-color 150ms ease-out;
}
.pekulo-btn:not(:disabled):hover { opacity: 0.92; }
.pekulo-btn:not(:disabled):active { transform: translateY(1px); }
.pekulo-btn:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
.pekulo-btn[data-variant="link"]:not(:disabled):hover {
  text-decoration: underline;
  text-underline-offset: 4px;
  opacity: 1;
}
`;

const SIZE_DIMS: Record<
  PekuloButtonSize,
  { height: number; paddingX?: number; iconOnly?: boolean; fontSize: number; gap: number }
> = {
  default: {
    height: pekuloSpacing[8],
    paddingX: pekuloSpacing[3],
    fontSize: pekuloFontSizes.bodySm,
    gap: 6,
  },
  xs: {
    height: pekuloSpacing[6],
    paddingX: pekuloSpacing[2],
    fontSize: pekuloFontSizes.xs,
    gap: 4,
  },
  sm: { height: 28, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.caption, gap: 4 },
  lg: { height: 36, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.bodySm, gap: 6 },
  icon: { height: pekuloSpacing[8], iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
  "icon-xs": { height: pekuloSpacing[6], iconOnly: true, fontSize: pekuloFontSizes.xs, gap: 0 },
  "icon-sm": { height: 28, iconOnly: true, fontSize: pekuloFontSizes.caption, gap: 0 },
  "icon-lg": { height: 36, iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
};

const variantStyle = (variant: PekuloButtonVariant): CSSProperties => {
  switch (variant) {
    case "default":
      return {
        backgroundColor: "var(--color)",
        color: "var(--colorOnAccent)",
        border: "1px solid transparent",
      };
    case "outline":
      return {
        backgroundColor: "transparent",
        color: "var(--color)",
        border: "1px solid var(--borderDefault)",
      };
    case "secondary":
      return {
        backgroundColor: "var(--backgroundMuted)",
        color: "var(--color)",
        border: "1px solid transparent",
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        color: "var(--color)",
        border: "1px solid transparent",
      };
    case "destructive":
      return {
        backgroundColor: "var(--danger)",
        color: "var(--colorOnAccent)",
        border: "1px solid transparent",
      };
    case "link":
      return {
        backgroundColor: "transparent",
        color: "var(--color)",
        border: "1px solid transparent",
        textDecoration: "none",
      };
  }
};

export function PekuloButton({
  variant = "default",
  size = "default",
  loading = false,
  loadingLabel,
  type = "button",
  disabled,
  className,
  style,
  children,
  ...props
}: PekuloButtonProps) {
  const isDisabled = disabled || loading;
  const dims = SIZE_DIMS[size];
  const variantStyles = variantStyle(variant);
  const merged: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: dims.gap,
    height: dims.height,
    width: dims.iconOnly ? dims.height : undefined,
    padding: dims.iconOnly ? 0 : `0 ${dims.paddingX}px`,
    borderRadius: size === "xs" || size === "icon-xs" ? pekuloRadius.md : pekuloRadius.lg,
    fontSize: dims.fontSize,
    fontWeight: pekuloFontWeights.medium,
    fontFamily: "inherit",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    whiteSpace: "nowrap",
    userSelect: "none",
    ...variantStyles,
    ...style,
  };
  const cls = ["pekulo-btn", className].filter(Boolean).join(" ");
  return (
    <>
      <style>{PEKULO_BUTTON_CSS}</style>
      <button
        type={type}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        aria-busy={loading ? "true" : undefined}
        disabled={isDisabled}
        className={cls}
        style={merged}
        {...props}
      >
        {loading && <PekuloSpinner size={dims.fontSize - 2} ariaLabel="" />}
        {loading && loadingLabel !== undefined ? loadingLabel : children}
      </button>
    </>
  );
}
