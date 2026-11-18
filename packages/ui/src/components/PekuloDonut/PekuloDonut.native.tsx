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
  const safeSize = Number.isFinite(size) && size > 0 ? size : 96;
  const safeStroke = Number.isFinite(stroke) && stroke >= 0 ? stroke : 8;
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct)) : 0;
  const animated = useCountUp(clamped, { durationMs: 900, fromZero: true });
  const safeAnimated = Number.isFinite(animated) ? Math.max(0, Math.min(1, animated)) : clamped;
  const radius = Math.max(0, (safeSize - safeStroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeAnimated);
  const labelPct = Math.round(safeAnimated * 100);

  return (
    <View
      width={safeSize}
      height={safeSize}
      alignItems="center"
      justifyContent="center"
      position="relative"
      accessibilityRole={ariaLabel ? "image" : undefined}
      accessibilityLabel={ariaLabel}
      accessibilityElementsHidden={!ariaLabel}
    >
      <Svg width={safeSize} height={safeSize} viewBox={`0 0 ${safeSize} ${safeSize}`}>
        <Circle
          cx={safeSize / 2}
          cy={safeSize / 2}
          r={radius}
          fill="none"
          stroke={theme.donutTrack.val}
          strokeWidth={safeStroke}
        />
        <Circle
          cx={safeSize / 2}
          cy={safeSize / 2}
          r={radius}
          fill="none"
          stroke={theme.donutFill.val}
          strokeWidth={safeStroke}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${safeSize / 2}, ${safeSize / 2}`}
        />
      </Svg>
      {centered && (
        <View position="absolute" alignItems="center" justifyContent="center">
          <Text color="$color" fontSize={safeSize * 0.34} fontWeight="600">
            {labelPct}%
          </Text>
        </View>
      )}
    </View>
  );
}
