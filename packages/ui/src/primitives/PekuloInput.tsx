"use client";

// PekuloInput — native `<input>` wrapper with TR-strict styling. Stays
// uncontrolled-friendly (consumer passes value + onChange directly, as
// TanStack Form's `field.state.value` + `field.handleChange` need). The
// existing Tamagui `PekuloCheckbox` + `PekuloSelect` are compound
// controls intended for fancy UIs; native form integration uses
// `PekuloInput` (text/number/date/email/...), `PekuloNativeSelect`, and
// `PekuloNativeCheckbox`.

import type { CSSProperties, InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual size — defaults to "md". Renamed from `size` to avoid clashing
   * with HTML's `<input size>` numeric attribute. */
  controlSize?: "sm" | "md";
  /** When true, applies the danger ring (consumed by PekuloField data-invalid). */
  invalid?: boolean;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[8],
  md: pekuloSpacing[10],
};

const SIZE_PADDING_X: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[2],
  md: pekuloSpacing[3],
};

export const PekuloInput = forwardRef<HTMLInputElement, PekuloInputProps>(function PekuloInput(
  { controlSize = "md", invalid = false, style, ...props },
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
    ...style,
  };
  return <input data-slot="input" ref={ref} style={merged} {...props} />;
});
