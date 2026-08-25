"use client";

import type { CSSProperties, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";
import { PEKULO_FIELD_CLASS, PEKULO_FIELD_CSS } from "./form-focus-ring";

export interface PekuloTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const PekuloTextarea = forwardRef<HTMLTextAreaElement, PekuloTextareaProps>(
  function PekuloTextarea({ invalid = false, className, style, ...props }, ref) {
    const merged: CSSProperties = {
      width: "100%",
      minHeight: pekuloSpacing[20],
      backgroundColor: "var(--backgroundMuted)",
      color: "var(--color)",
      borderRadius: pekuloRadius.lg,
      padding: `${pekuloSpacing[2]}px ${pekuloSpacing[3]}px`,
      fontSize: pekuloFontSizes.bodySm,
      border: invalid ? "1px solid var(--danger)" : "none",
      fontFamily: "inherit",
      resize: "vertical",
      ...style,
    };
    return (
      <>
        <style>{PEKULO_FIELD_CSS}</style>
        <textarea
          data-slot="textarea"
          ref={ref}
          className={className ? `${PEKULO_FIELD_CLASS} ${className}` : PEKULO_FIELD_CLASS}
          style={merged}
          {...props}
        />
      </>
    );
  },
);
