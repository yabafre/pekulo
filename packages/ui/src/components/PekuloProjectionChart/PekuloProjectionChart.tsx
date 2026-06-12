"use client";

import { View, Text } from "tamagui";

export interface PekuloProjectionChartProps {
  years: number[];
  actual: number[];
  required: number[];
  /** Filled marker year value (where the user is now). */
  nowMarker?: { year: number; value: number };
  /** Outlined marker at horizon (the cap). */
  capMarker?: { year: number; value: number };
}

export function PekuloProjectionChart({
  years,
  actual,
  required,
  nowMarker,
  capMarker,
}: PekuloProjectionChartProps) {
  const width = 600;
  const height = 220;
  const padding = 12;
  const all = [...actual, ...required];
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
    <View>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Projection par rapport au cap requis"
      >
        <path
          d={toPath(required)}
          stroke="var(--chartPlan)"
          strokeWidth={2}
          strokeDasharray="4 4"
          fill="none"
        />
        <path d={toPath(actual)} stroke="var(--chartActual)" strokeWidth={2} fill="none" />
        {nowMarker && (
          <circle
            cx={toX(idxOf(nowMarker.year))}
            cy={toY(nowMarker.value)}
            r={5}
            fill="var(--chartActual)"
          />
        )}
        {capMarker && (
          <circle
            cx={toX(idxOf(capMarker.year))}
            cy={toY(capMarker.value)}
            r={5}
            fill="none"
            stroke="var(--chartActual)"
            strokeWidth={2}
          />
        )}
      </svg>
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
