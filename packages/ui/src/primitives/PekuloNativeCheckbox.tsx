"use client";

import type { CSSProperties, InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface PekuloNativeCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  /** Box size in px. Defaults to 20. */
  size?: number;
}

export const PekuloNativeCheckbox = forwardRef<HTMLInputElement, PekuloNativeCheckboxProps>(
  function PekuloNativeCheckbox({ size = 20, style, ...props }, ref) {
    const merged: CSSProperties = {
      width: size,
      height: size,
      accentColor: "var(--color)",
      cursor: "pointer",
      ...style,
    };
    return <input data-slot="checkbox" ref={ref} type="checkbox" style={merged} {...props} />;
  },
);
