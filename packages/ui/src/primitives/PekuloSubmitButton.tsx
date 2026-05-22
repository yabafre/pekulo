"use client";

// PekuloSubmitButton — the canonical form-submission pill. Absorbs the
// `submit-pill.module.css` interaction states (hover opacity, active
// scale-press, focus ring) via plain CSS pseudo-classes injected
// alongside the component. Renders a PekuloSpinner inline when
// `loading=true` so the calling form passes the mutation's `isPending`
// directly without composing its own spinner.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { pekuloRadius } from "../tokens";
import { PekuloSpinner } from "./PekuloSpinner";

export interface PekuloSubmitButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children"
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

const baseStyle = (
  variant: "primary" | "danger",
  fullWidth: boolean,
  isDisabled: boolean,
): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  alignSelf: fullWidth ? "stretch" : "flex-start",
  width: fullWidth ? "100%" : "auto",
  height: 44,
  padding: "0 24px",
  borderRadius: pekuloRadius.full,
  backgroundColor: variant === "danger" ? "var(--danger)" : "var(--color)",
  color: "var(--colorOnAccent)",
  fontSize: 14,
  fontWeight: 600,
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
        type="submit"
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
