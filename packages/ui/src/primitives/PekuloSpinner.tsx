"use client";

// PekuloSpinner — inline loading affordance. Lucide's `Loader2` mounted with
// a CSS keyframe rotation. The keyframe ships embedded in the component
// (idempotent — repeated declarations of the same `@keyframes` are merged
// by every modern browser) so the primitive stays self-contained and
// doesn't depend on a global CSS injection layer.

import { View } from "tamagui";
import { Loader2 } from "lucide-react";
import type { CSSProperties } from "react";

export interface PekuloSpinnerProps {
  /** Diameter in px. Defaults to 16 (matches body row-height). */
  size?: number;
  /** Optional override color (CSS var or hex). Defaults to inherit current color. */
  color?: string;
  /** Accessible label. Defaults to "Chargement" — set to "" to mark decorative. */
  ariaLabel?: string;
}

const SPIN_KEYFRAMES = "@keyframes pekulo-spin-360{to{transform:rotate(360deg)}}";

const spinStyle: CSSProperties = {
  animation: "pekulo-spin-360 1s linear infinite",
};

export function PekuloSpinner({ size = 16, color, ariaLabel = "Chargement" }: PekuloSpinnerProps) {
  const ariaProps =
    ariaLabel.length > 0
      ? { role: "status" as const, "aria-label": ariaLabel }
      : { "aria-hidden": true as const };
  return (
    <>
      <style href="pekulo-spinner" precedence="medium">
        {SPIN_KEYFRAMES}
      </style>
      <View
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        style={spinStyle}
        {...ariaProps}
      >
        <Loader2 size={size} color={color ?? "currentColor"} aria-hidden={true} />
      </View>
    </>
  );
}
