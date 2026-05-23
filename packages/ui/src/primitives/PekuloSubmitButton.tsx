"use client";

// PekuloSubmitButton — thin specialisation of PekuloButton for the
// form-submission pill. Maps:
//   variant="primary" → PekuloButton variant="default"
//   variant="danger"  → PekuloButton variant="destructive"
// and forces `size="lg"` + `fullWidth=true` defaults (the form pill is
// always full-width 44px-floor per WCAG 2.5.5 touch target).
//
// Kept as a named primitive so consumers (11 form files) don't need to
// reach for size+fullWidth defaults at every call site.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PekuloButton, type PekuloButtonVariant } from "./PekuloButton";
import { pekuloRadius } from "../tokens";

export interface PekuloSubmitButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
  /** "primary" → default-variant button, "danger" → destructive-variant. */
  variant?: "primary" | "danger";
  /** Stretch to parent width. Defaults to true. */
  fullWidth?: boolean;
  type?: "submit" | "button" | "reset";
}

const VARIANT_MAP: Record<NonNullable<PekuloSubmitButtonProps["variant"]>, PekuloButtonVariant> = {
  primary: "default",
  danger: "destructive",
};

export function PekuloSubmitButton({
  children,
  loading = false,
  loadingLabel,
  variant = "primary",
  fullWidth = true,
  type = "submit",
  style,
  ...props
}: PekuloSubmitButtonProps) {
  return (
    <PekuloButton
      variant={VARIANT_MAP[variant]}
      size="lg"
      type={type}
      loading={loading}
      loadingLabel={loadingLabel}
      style={{
        // PILL_HEIGHT — 44px = WCAG 2.5.5 touch-target floor. No spacing
        // token lands exactly here (10=40, 12=48). Override on top of the
        // generic Button.
        height: 44,
        alignSelf: fullWidth ? "stretch" : "flex-start",
        width: fullWidth ? "100%" : "auto",
        borderRadius: pekuloRadius.full,
        ...style,
      }}
      {...props}
    >
      {children}
    </PekuloButton>
  );
}
