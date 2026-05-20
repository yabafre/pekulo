"use client";

// packages/ui/src/components/PekuloCountUpPct.tsx
// Count-up animated percent display. Same shape as PekuloCountUpEUR but
// formats as `(v * 100).toFixed(precise ? 1 : 0) + '%'`.

import { Text, type TextProps } from "tamagui";
import { useCountUp } from "../../animations/use-count-up";

export interface PekuloCountUpPctProps extends Omit<TextProps, "children"> {
  /** Fraction in 0..1. */
  value: number;
  /** When true, formats with 1 decimal; else 0. Default false. */
  precise?: boolean;
  /** Animation duration in ms (default 900 ms). */
  durationMs?: number;
}

export function PekuloCountUpPct({
  value,
  precise = false,
  durationMs = 900,
  ...textProps
}: PekuloCountUpPctProps) {
  const animated = useCountUp(value, { durationMs });
  const formatted = `${(animated * 100).toFixed(precise ? 1 : 0)} %`;
  return <Text {...textProps}>{formatted}</Text>;
}
