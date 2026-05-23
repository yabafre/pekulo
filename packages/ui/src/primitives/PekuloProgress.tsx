"use client";

// PekuloProgress — linear progress bar. Self-contained (plain HTML +
// CSS), no Tamagui Progress dependency — the latter renders an Indicator
// child whose transform is set via a CSS variable that doesn't always
// apply in our setup. The shadcn pattern (a div with a div inside whose
// width = value%) is simpler and always works.
//
// Keeps the compound API surface for backwards compat: `Root` is the
// default export (via Object.assign), and `Indicator` is a no-op alias
// that consumers can still mount as a child without effect — the Root
// renders the fill on its own.

import type { CSSProperties, ReactNode } from "react";
import { pekuloRadius } from "../tokens";

export interface PekuloProgressProps {
  /** Progress value (0..max). Default max is 100. */
  value?: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Bar height in px. Defaults to 6. */
  height?: number;
  /** Accessible label. Defaults to "Progression". */
  ariaLabel?: string;
  /**
   * Compound-API compatibility. Any child rendered inside Root is
   * ignored — the fill is drawn by Root itself. Existing consumers can
   * still pass `<PekuloProgress.Indicator />` for visual symmetry.
   */
  children?: ReactNode;
  style?: CSSProperties;
}

function Root({
  value = 0,
  max = 100,
  height = 6,
  ariaLabel = "Progression",
  style,
}: PekuloProgressProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max === 0 ? 0 : (clamped / max) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      data-slot="progress"
      style={{
        position: "relative",
        width: "100%",
        height,
        backgroundColor: "var(--backgroundMuted)",
        borderRadius: pekuloRadius.full,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        data-slot="progress-indicator"
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: "var(--color)",
          borderRadius: pekuloRadius.full,
          transition: "width 300ms ease-out",
        }}
      />
    </div>
  );
}

// Compound API compat — Indicator is a no-op. Root renders the fill.
function Indicator() {
  return null;
}

export const PekuloProgress = Object.assign(Root, { Indicator });
