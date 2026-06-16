"use client";

// packages/ui/src/components/PekuloCountUpEUR.tsx
// Count-up animated currency display. Honours prefers-reduced-motion
// (resolves immediately to the target via useCountUp's reduced-motion
// branch).

import { Text, type TextProps } from "tamagui";
import { useCountUp } from "../../animations/use-count-up";

export interface PekuloCountUpEURProps extends Omit<TextProps, "children"> {
  value: number;
  /** When true, formats with 2 decimals; else 0. Default false. */
  precise?: boolean;
  /** Animation duration in ms (default 900 ms — match Hero). */
  durationMs?: number;
  /**
   * Count up from 0 → value on mount (the figure "rolls in"). Opt-in so inline
   * currency displays that only react to value changes keep the current
   * behaviour. Honours prefers-reduced-motion (settles at value, no roll).
   */
  fromZero?: boolean;
}

export function PekuloCountUpEUR({
  value,
  precise = false,
  durationMs = 900,
  fromZero = false,
  ...textProps
}: PekuloCountUpEURProps) {
  const animated = useCountUp(value, { durationMs, fromZero });
  const fmt = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  });
  return <Text {...textProps}>{fmt.format(animated)}</Text>;
}
