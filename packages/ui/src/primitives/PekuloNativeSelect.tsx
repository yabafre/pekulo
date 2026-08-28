"use client";

// PekuloNativeSelect — native `<select>` wrapper. The compound
// `PekuloSelect` (from `./PekuloSelect`) wraps `@tamagui/select` for fancy
// custom-popover use-cases. This primitive stays on the native control
// because form integration with TanStack Form + RSC is simpler and the
// accessibility behaviour ships free.
//
// Visual affordance: wraps the native `<select>` in a relative div with
// an absolute-positioned ChevronDown icon on the right edge so the user
// can tell at a glance that this is a dropdown (browser default doesn't
// always render a visible arrow on macOS / Safari).

import { ChevronDown } from "lucide-react";
import type { CSSProperties, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";
import { PEKULO_FIELD_CLASS, PEKULO_FIELD_CSS } from "./form-focus-ring";

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

const CHEVRON_WIDTH = 28;

export const PekuloNativeSelect = forwardRef<HTMLSelectElement, PekuloNativeSelectProps>(
  function PekuloNativeSelect(
    { controlSize = "md", invalid = false, className, style, children, disabled, ...props },
    ref,
  ) {
    const merged: CSSProperties = {
      width: "100%",
      height: SIZE_HEIGHT[controlSize],
      backgroundColor: "var(--backgroundMuted)",
      color: "var(--color)",
      borderRadius: pekuloRadius.lg,
      // Reserve room for the chevron on the right.
      padding: `0 ${CHEVRON_WIDTH}px 0 ${SIZE_PADDING_X[controlSize]}px`,
      fontSize: pekuloFontSizes.bodySm,
      border: invalid ? "1px solid var(--danger)" : "none",
      fontFamily: "inherit",
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style,
    };
    return (
      <div
        data-slot="native-select-wrapper"
        style={{ position: "relative", display: "block", width: "100%" }}
      >
        <style href="pekulo-field" precedence="medium">
          {PEKULO_FIELD_CSS}
        </style>
        <select
          data-slot="select"
          ref={ref}
          className={className ? `${PEKULO_FIELD_CLASS} ${className}` : PEKULO_FIELD_CLASS}
          style={merged}
          disabled={disabled}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden={true}
          size={16}
          color="var(--colorTertiary)"
          style={{
            position: "absolute",
            top: "50%",
            right: pekuloSpacing[3],
            transform: "translateY(-50%)",
            pointerEvents: "none",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>
    );
  },
);
