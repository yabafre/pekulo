// packages/ui/src/components/PekuloProjectionChart/PekuloProjectionChart.native.tsx
// Native hypothesis projection vs cap-required SVG chart using react-native-svg + useTheme().

import Svg, { Circle, Path } from "react-native-svg";
import { Text, View, useTheme } from "tamagui";

export interface PekuloProjectionChartProps {
  years: number[];
  actual: number[];
  required: number[];
  nowMarker?: { year: number; value: number };
  capMarker?: { year: number; value: number };
  ariaLabel?: string;
}

export function PekuloProjectionChart({
  years,
  actual,
  required,
  nowMarker,
  capMarker,
  ariaLabel = "Projection par rapport au cap requis",
}: PekuloProjectionChartProps) {
  const theme = useTheme();
  const width = 600;
  const height = 220;
  const padding = 12;
  const all = [
    ...actual,
    ...required,
    ...(nowMarker ? [nowMarker.value] : []),
    ...(capMarker ? [capMarker.value] : []),
  ];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(max - min, 1);
  const xStep = (width - 2 * padding) / Math.max(years.length - 1, 1);
  const toX = (i: number) => padding + i * xStep;
  const toY = (v: number) => padding + (height - 2 * padding) * (1 - (v - min) / range);
  const toPath = (d: number[]) =>
    d.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
  const idxOf = (y: number) => Math.max(0, years.indexOf(y));

  return (
    <View flexDirection="column">
      <View height={height} accessibilityRole="image" accessibilityLabel={ariaLabel}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <Path
            d={toPath(required)}
            stroke={theme.chartPlan.val}
            strokeWidth={2}
            strokeDasharray={[4, 4]}
            fill="none"
          />
          <Path d={toPath(actual)} stroke={theme.chartActual.val} strokeWidth={2} fill="none" />
          {nowMarker && (
            <Circle
              cx={toX(idxOf(nowMarker.year))}
              cy={toY(nowMarker.value)}
              r={5}
              fill={theme.chartActual.val}
            />
          )}
          {capMarker && (
            <Circle
              cx={toX(idxOf(capMarker.year))}
              cy={toY(capMarker.value)}
              r={5}
              fill="none"
              stroke={theme.chartActual.val}
              strokeWidth={2}
            />
          )}
        </Svg>
      </View>
      <View flexDirection="row" justifyContent="space-between" marginTop="$1">
        <Text color="$colorTertiary" fontSize="$11">
          {years[0]}
        </Text>
        <Text color="$colorTertiary" fontSize="$11">
          {years[years.length - 1]}
        </Text>
      </View>
    </View>
  );
}
