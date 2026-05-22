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
import { pekuloRadius } from "../tokens";

export interface PekuloInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual size — defaults to "md". Renamed from `size` to avoid clashing
   * with HTML's `<input size>` numeric attribute. */
  controlSize?: "sm" | "md";
  /** When true, applies the danger ring (consumed by PekuloField data-invalid). */
  invalid?: boolean;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: 32,
  md: 40,
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
    padding: controlSize === "sm" ? "0 10px" : "0 12px",
    fontSize: 14,
    border: invalid ? "1px solid var(--danger)" : "none",
    outline: "none",
    fontFamily: "inherit",
    ...style,
  };
  return <input data-slot="input" ref={ref} style={merged} {...props} />;
});
