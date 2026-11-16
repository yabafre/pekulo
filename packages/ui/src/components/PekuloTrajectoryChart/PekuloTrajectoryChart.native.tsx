// packages/ui/src/components/PekuloTrajectoryChart/PekuloTrajectoryChart.native.tsx
// Native trajectory SVG chart (actual solid + plan dashed) using react-native-svg + useTheme().

import Svg, { Path } from "react-native-svg";
import { View, useTheme } from "tamagui";

export interface PekuloTrajectoryChartProps {
  months: number[];
  actual: number[];
  plan: number[];
  tall?: boolean;
  inCard?: boolean;
}

export function PekuloTrajectoryChart({
  months,
  actual,
  plan,
  tall,
  inCard,
}: PekuloTrajectoryChartProps) {
  const theme = useTheme();
  const width = 600;
  const height = tall ? 220 : 180;
  const padding = 8;
  const all = [...actual, ...plan];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(max - min, 1);
  const xStep = (width - 2 * padding) / Math.max(months.length - 1, 1);
  const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
  const toPath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? "M" : "L"} ${padding + i * xStep} ${toY(v)}`).join(" ");

  const inner = (
    <View
      width="100%"
      height={height}
      accessibilityRole="image"
      accessibilityLabel="Trajectoire patrimoine"
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={toPath(plan)}
          stroke={theme.chartPlan.val}
          strokeWidth={2}
          strokeDasharray={[4, 4]}
          fill="none"
        />
        <Path d={toPath(actual)} stroke={theme.chartActual.val} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );

  if (inCard) {
    return (
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5">
        {inner}
      </View>
    );
  }
  return inner;
}
