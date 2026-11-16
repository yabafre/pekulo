// packages/ui/src/components/PekuloDonut/PekuloDonut.native.tsx
// Native TR-style ring chart rendered with react-native-svg + Tamagui useTheme().

import Svg, { Circle } from "react-native-svg";
import { Text, View, useTheme } from "tamagui";
import { useCountUp } from "../../animations/use-count-up";

export interface PekuloDonutProps {
  pct: number;
  size?: number;
  stroke?: number;
  centered?: boolean;
  ariaLabel?: string;
}

export function PekuloDonut({ pct, size = 96, stroke = 8, centered, ariaLabel }: PekuloDonutProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  const animated = useCountUp(clamped, { durationMs: 900, fromZero: true });
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated);
  const labelPct = Math.round(animated * 100);

  return (
    <View
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      position="relative"
      accessibilityRole={ariaLabel ? "image" : undefined}
      accessibilityLabel={ariaLabel}
      accessibilityElementsHidden={!ariaLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.donutTrack.val}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.donutFill.val}
          strokeWidth={stroke}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
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
