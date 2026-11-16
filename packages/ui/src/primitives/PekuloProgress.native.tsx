// packages/ui/src/primitives/PekuloProgress.native.tsx
import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "tamagui";
import { pekuloRadius } from "../tokens";

export interface PekuloProgressProps {
  value?: number;
  max?: number;
  height?: number;
  ariaLabel?: string;
  children?: ReactNode;
  style?: ViewStyle;
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
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ min: 0, max, now: Math.round(clamped) }}
      width="100%"
      height={height}
      backgroundColor="$backgroundMuted"
      borderRadius={pekuloRadius.full}
      overflow="hidden"
      style={style}
    >
      <View
        width={`${pct}%`}
        height="100%"
        backgroundColor="$color"
        borderRadius={pekuloRadius.full}
      />
    </View>
  );
}

function Indicator() {
  return null;
}

export const PekuloProgress = Object.assign(Root, { Indicator });
