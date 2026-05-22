"use client";

import type { CSSProperties, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { pekuloRadius } from "../tokens";

export interface PekuloTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const PekuloTextarea = forwardRef<HTMLTextAreaElement, PekuloTextareaProps>(
  function PekuloTextarea({ invalid = false, style, ...props }, ref) {
    const merged: CSSProperties = {
      width: "100%",
      minHeight: 80,
      backgroundColor: "var(--backgroundMuted)",
      color: "var(--color)",
      borderRadius: pekuloRadius.lg,
      padding: "10px 12px",
      fontSize: 14,
      border: invalid ? "1px solid var(--danger)" : "none",
      outline: "none",
      fontFamily: "inherit",
      resize: "vertical",
      ...style,
    };
    return <textarea data-slot="textarea" ref={ref} style={merged} {...props} />;
  },
);
