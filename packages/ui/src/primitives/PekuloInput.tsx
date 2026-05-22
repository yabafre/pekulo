"use client";

// PekuloInput — native `<input>` wrapper with TR-strict styling. Stays
// uncontrolled-friendly (consumer passes value + onChange directly, as
// TanStack Form's `field.state.value` + `field.handleChange` need).
//
// Type restrictions:
//   - `type="date"` is FORBIDDEN. Use PekuloDatePicker instead — native
//     `<input type="date">` ships an inconsistent OS-controlled picker
//     that breaks our TR-strict palette.
//
// Password reveal:
//   - `type="password"` automatically renders an Eye/EyeOff toggle on
//     the right edge of the input. Opt out with `revealable={false}`
//     if the consumer wants the raw password input.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

// Allowed HTML input types. `date` and `datetime-local` deliberately
// excluded — consumers must use PekuloDatePicker for those use cases.
// `month`, `week`, `time` are allowed (no Pekulo alternative yet).
type AllowedInputType =
  | "text"
  | "number"
  | "email"
  | "password"
  | "tel"
  | "url"
  | "search"
  | "time"
  | "month"
  | "week"
  | "color"
  | "hidden";

export interface PekuloInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> {
  /** Visual size — defaults to "md". Renamed from `size` to avoid clashing
   * with HTML's `<input size>` numeric attribute. */
  controlSize?: "sm" | "md";
  /** When true, applies the danger ring (consumed by PekuloField data-invalid). */
  invalid?: boolean;
  /**
   * Restricted HTML input type. `"date"` and `"datetime-local"` are
   * excluded — use PekuloDatePicker for date inputs.
   */
  type?: AllowedInputType;
  /**
   * Password reveal toggle. When `true` AND `type="password"`, renders
   * an Eye / EyeOff button on the right edge that flips the input type
   * between password and text. Defaults to `true` for password inputs,
   * `false` otherwise.
   */
  revealable?: boolean;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[8],
  md: pekuloSpacing[10],
};

const SIZE_PADDING_X: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[2],
  md: pekuloSpacing[3],
};

const REVEAL_BTN_WIDTH = 36;

export const PekuloInput = forwardRef<HTMLInputElement, PekuloInputProps>(function PekuloInput(
  { controlSize = "md", invalid = false, style, type = "text", revealable, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  // Default revealable=true for password, false otherwise.
  const showRevealToggle = isPassword && (revealable ?? true);
  const effectiveType = showRevealToggle && revealed ? "text" : type;

  const paddingRight = showRevealToggle ? REVEAL_BTN_WIDTH : SIZE_PADDING_X[controlSize];
  const merged: CSSProperties = {
    width: "100%",
    height: SIZE_HEIGHT[controlSize],
    backgroundColor: "var(--backgroundMuted)",
    color: "var(--color)",
    borderRadius: pekuloRadius.lg,
    padding: `0 ${paddingRight}px 0 ${SIZE_PADDING_X[controlSize]}px`,
    fontSize: pekuloFontSizes.bodySm,
    border: invalid ? "1px solid var(--danger)" : "none",
    outline: "none",
    fontFamily: "inherit",
    ...style,
  };

  if (!showRevealToggle) {
    return <input data-slot="input" ref={ref} type={effectiveType} style={merged} {...props} />;
  }

  return (
    <div
      data-slot="input-wrapper"
      style={{ position: "relative", display: "block", width: "100%" }}
    >
      <input data-slot="input" ref={ref} type={effectiveType} style={merged} {...props} />
      <button
        type="button"
        aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={revealed}
        onClick={() => setRevealed((v) => !v)}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: SIZE_HEIGHT[controlSize],
          width: REVEAL_BTN_WIDTH,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--colorTertiary)",
          borderRadius: pekuloRadius.lg,
        }}
      >
        {revealed ? <EyeOff size={16} aria-hidden={true} /> : <Eye size={16} aria-hidden={true} />}
      </button>
    </div>
  );
});
