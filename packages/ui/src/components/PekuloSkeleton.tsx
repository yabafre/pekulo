"use client";

import { View } from "tamagui";

export interface PekuloSkeletonProps {
  /** Number of grey lines (decreasing width). Default 1. */
  lines?: number;
  /** Single-block height (px). Default 16. */
  height?: number;
  /** Render as a single block instead of N lines. */
  block?: boolean;
  /** Override width — overrides the calculated `100 - i*12%` per-line width
   *  and the default `100%` block width. Accepts the same value types as
   *  Tamagui View `width`. Use for nested inline skeletons where a fixed
   *  px size matches the loaded content footprint better than a %. */
  width?: number | `${number}%`;
}

export function PekuloSkeleton({ lines = 1, height = 16, block, width }: PekuloSkeletonProps) {
  if (block) {
    return (
      <View
        width={width ?? "100%"}
        height={height}
        borderRadius="$md"
        backgroundColor="$backgroundMuted"
        opacity={0.6}
        aria-hidden
      />
    );
  }
  return (
    <View flexDirection="column" gap={6} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          height={height}
          width={width ?? `${100 - i * 12}%`}
          borderRadius="$sm"
          backgroundColor="$backgroundMuted"
          opacity={0.6}
        />
      ))}
    </View>
  );
}
