"use client";

// PekuloLabel — standalone `<label>` primitive for fields rendered
// outside a PekuloField composition (e.g. an isolated checkbox in the
// settings page, a controlled switch in a dialog). Inside a PekuloField,
// prefer PekuloFieldLabel (it inherits the field's data-disabled state +
// adds the FieldLabel data-slot for query selectors).
//
// Shadcn-parity: maps to native `<label>` with TR-strict typography
// tokens. Disabled state is driven by an ancestor with
// `data-disabled="true"` (e.g. the PekuloField primitive) — no Radix
// dependency needed.

import { pekuloFontSizes, pekuloFontWeights } from "../tokens";
import type { CSSProperties, LabelHTMLAttributes, ReactNode } from "react";

export interface PekuloLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children?: ReactNode;
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: pekuloFontSizes.bodySm,
  fontWeight: pekuloFontWeights.medium,
  lineHeight: 1,
  color: "var(--color)",
  userSelect: "none",
  cursor: "default",
};

const LABEL_CSS = `
[data-disabled="true"] > [data-slot="label"],
[data-disabled="true"] [data-slot="label"] {
  pointer-events: none;
  opacity: 0.5;
}
`;

export function PekuloLabel({ style, children, ...props }: PekuloLabelProps) {
  return (
    <>
      <style>{LABEL_CSS}</style>
      {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control --
       * lint can't see the control passed via htmlFor at the call site,
       * which is the intended pattern for a standalone Label primitive. */}
      <label data-slot="label" style={{ ...baseStyle, ...style }} {...props}>
        {children}
      </label>
    </>
  );
}
