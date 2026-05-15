"use client";

// packages/ui/src/components/PekuloDonut.tsx
// TR-style ring — white stroke on dim track. Animated sweep on mount via
// useCountUp. Dark mode = white fill on white-08 track ; light mode = ink
// fill on black-08 track (driven by Pekulo theme tokens donutFill/donutTrack).

import { View, Text } from "tamagui";
import { useCountUp } from "../animations/use-count-up";

export interface PekuloDonutProps {
  /** Progress fraction (0..1). */
  pct: number;
  /** Outer diameter (px). Default 96. */
  size?: number;
  /** Stroke width (px). Default 8. */
  stroke?: number;
  /** Render the percentage label centered. */
  centered?: boolean;
  /**
   * Accessible name for the donut SVG. When provided, the donut becomes
   * `role="img"` with this label; otherwise it stays decorative
   * (`aria-hidden`) and the surrounding section is expected to carry the
   * accessible name (small donuts inside list rows). Story 1-4 AC-1
   * requires the dashboard donut to expose `"Cap NN.N %"` on the svg
   * itself, so consumers MUST pass `ariaLabel` for the hero donut.
   */
  ariaLabel?: string;
}

export function PekuloDonut({ pct, size = 96, stroke = 8, centered, ariaLabel }: PekuloDonutProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const animated = useCountUp(clamped, { durationMs: 900 });
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated);
  const labelPct = Math.round(animated * 100);
  const svgProps = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  return (
    <View
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        focusable={false}
        {...svgProps}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--donutTrack)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--donutFill)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {centered && (
        <View position="absolute" alignItems="center" justifyContent="center">
          <Text color="$color" fontSize={size * 0.34} fontWeight="600">
            {labelPct}%
          </Text>
        </View>
      )}
    </View>
  );
}
