"use client";

import { View } from "tamagui";

// Single shared keyframes block — rendered inline with the skeleton so the
// component is portable (no global CSS dependency). Browser dedupes
// identical keyframes by name; rendering N copies is harmless. The pulse
// matches shadcn's `animate-pulse` rhythm (1.5 s ease-in-out, opacity
// 0.6 ↔ 0.3) but stays inside the TR-strict palette ($backgroundMuted).
const KEYFRAMES = `@keyframes pekulo-skeleton-pulse {
  0%, 100% { opacity: 0.6 }
  50% { opacity: 0.3 }
}`;
const PULSE_ANIMATION = "pekulo-skeleton-pulse 1.5s ease-in-out infinite";

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
      <>
        <style>{KEYFRAMES}</style>
        <View
          width={width ?? "100%"}
          height={height}
          borderRadius="$md"
          backgroundColor="$backgroundMuted"
          style={{ animation: PULSE_ANIMATION }}
          aria-hidden
        />
      </>
    );
  }
  return (
    <>
      <style>{KEYFRAMES}</style>
      <View flexDirection="column" gap={6} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <View
            key={i}
            height={height}
            width={width ?? `${100 - i * 12}%`}
            borderRadius="$sm"
            backgroundColor="$backgroundMuted"
            style={{ animation: PULSE_ANIMATION }}
          />
        ))}
      </View>
    </>
  );
}
