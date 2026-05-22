"use client";

// PekuloSubmitButton — the canonical form-submission pill. Absorbs the
// `submit-pill.module.css` interaction states (hover opacity, active
// scale-press, focus ring) via plain CSS pseudo-classes injected
// alongside the component. Renders a PekuloSpinner inline when
// `loading=true` so the calling form passes the mutation's `isPending`
// directly without composing its own spinner.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";
import { PekuloSpinner } from "./PekuloSpinner";

export interface PekuloSubmitButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Label rendered on the button. */
  children: ReactNode;
  /** Spinner-during-submit indicator. Also sets aria-busy + disabled. */
  loading?: boolean;
  /** Override label rendered next to the spinner during loading. */
  loadingLabel?: ReactNode;
  /** Visual variant. Defaults to "primary" (filled pill). */
  variant?: "primary" | "danger";
  /** Stretch to parent width. Defaults to true. */
  fullWidth?: boolean;
  /** HTML button type. Defaults to "submit" (in-form usage). Override to
   * "button" when the pill drives an imperative action outside a form. */
  type?: "submit" | "button" | "reset";
}

const PILL_INTERACTION_CSS = `
.pekulo-submit-pill {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: opacity 150ms ease-out, transform 100ms ease-out;
}
.pekulo-submit-pill:not(:disabled):hover { opacity: 0.92; }
.pekulo-submit-pill:not(:disabled):active { transform: scale(0.98); }
.pekulo-submit-pill:focus-visible {
  outline: 2px solid var(--color);
  outline-offset: 2px;
}
`;

// 44px height has no exact spacing token (pekuloSpacing[10]=40,
// pekuloSpacing[12]=48). Touch-target floor is 44 per WCAG 2.5.5, so we
// hold the legacy value and document the deviation here.
const PILL_HEIGHT = 44;

const baseStyle = (
  variant: "primary" | "danger",
  fullWidth: boolean,
  isDisabled: boolean,
): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: pekuloSpacing[2],
  alignSelf: fullWidth ? "stretch" : "flex-start",
  width: fullWidth ? "100%" : "auto",
  height: PILL_HEIGHT,
  padding: `0 ${pekuloSpacing[6]}px`,
  borderRadius: pekuloRadius.full,
  backgroundColor: variant === "danger" ? "var(--danger)" : "var(--color)",
  color: "var(--colorOnAccent)",
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: pekuloFontWeights.semibold,
  letterSpacing: 0.1,
  border: "none",
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.6 : 1,
  fontFamily: "inherit",
});

export function PekuloSubmitButton({
  children,
  loading = false,
  loadingLabel,
  variant = "primary",
  fullWidth = true,
  type = "submit",
  disabled,
  className,
  style,
  ...props
}: PekuloSubmitButtonProps) {
  const isDisabled = disabled || loading;
  const merged: CSSProperties = {
    ...baseStyle(variant, fullWidth, isDisabled),
    ...style,
  };
  const cls = ["pekulo-submit-pill", className].filter(Boolean).join(" ");
  return (
    <>
      <style>{PILL_INTERACTION_CSS}</style>
      <button
        type={type}
        data-slot="submit-button"
        aria-busy={loading ? "true" : undefined}
        disabled={isDisabled}
        className={cls}
        style={merged}
        {...props}
      >
        {loading && <PekuloSpinner size={14} ariaLabel="" />}
        <span>{loading && loadingLabel !== undefined ? loadingLabel : children}</span>
      </button>
    </>
  );
}
