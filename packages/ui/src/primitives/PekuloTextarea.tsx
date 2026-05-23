"use client";

import type { CSSProperties, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const PekuloTextarea = forwardRef<HTMLTextAreaElement, PekuloTextareaProps>(
  function PekuloTextarea({ invalid = false, style, ...props }, ref) {
    const merged: CSSProperties = {
      width: "100%",
      minHeight: pekuloSpacing[20],
      backgroundColor: "var(--backgroundMuted)",
      color: "var(--color)",
      borderRadius: pekuloRadius.lg,
      padding: `${pekuloSpacing[2]}px ${pekuloSpacing[3]}px`,
      fontSize: pekuloFontSizes.bodySm,
      border: invalid ? "1px solid var(--danger)" : "none",
      outline: "none",
      fontFamily: "inherit",
      resize: "vertical",
      ...style,
    };
    return <textarea data-slot="textarea" ref={ref} style={merged} {...props} />;
  },
);
