"use client";

import { View } from "tamagui";

export interface PekuloSkeletonProps {
  /** Number of grey lines (decreasing width). Default 1. */
  lines?: number;
  /** Single-block height (px). Default 16. */
  height?: number;
  /** Render as a single block instead of N lines. */
  block?: boolean;
}

export function PekuloSkeleton({ lines = 1, height = 16, block }: PekuloSkeletonProps) {
  if (block) {
    return (
      <View
        width="100%"
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
          width={`${100 - i * 12}%`}
          borderRadius="$sm"
          backgroundColor="$backgroundMuted"
          opacity={0.6}
        />
      ))}
    </View>
  );
}
