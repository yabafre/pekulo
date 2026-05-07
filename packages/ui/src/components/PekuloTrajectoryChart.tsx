"use client";

// packages/ui/src/components/PekuloTrajectoryChart.tsx
// Inline SVG — actual (white solid) + plan (dim dashed). Coordinates passed
// as { months: number[]; actual: number[]; plan: number[] }; the chart
// normalises to a 600 × {180|220} viewBox.

import { View } from "tamagui";

export interface PekuloTrajectoryChartProps {
  months: number[];
  actual: number[];
  plan: number[];
  /** 220 px height variant (vs default 180). */
  tall?: boolean;
  /** Wrap in card surface (false = parent already a Section). */
  inCard?: boolean;
}

export function PekuloTrajectoryChart({
  months,
  actual,
  plan,
  tall,
  inCard,
}: PekuloTrajectoryChartProps) {
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
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Trajectoire patrimoine"
    >
      <path
        d={toPath(plan)}
        stroke="var(--chartPlan)"
        strokeWidth={2}
        strokeDasharray="4 4"
        fill="none"
      />
      <path d={toPath(actual)} stroke="var(--chartActual)" strokeWidth={2} fill="none" />
    </svg>
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
