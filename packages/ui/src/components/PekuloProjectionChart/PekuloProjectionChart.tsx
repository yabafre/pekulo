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
  /**
   * Story 8-2 i18n — accessible name for the chart. The consumer passes the
   * translated string; defaults to the FR source so the pure-UI package keeps
   * a sensible fallback without depending on next-intl.
   */
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
  const width = 600;
  const height = 220;
  const padding = 12;
  // Include the markers in the Y domain — otherwise a now/cap value that sits
  // outside the [min,max] of the two series renders off-canvas (clipped above
  // or below the plot). Both series + both markers define the visible range.
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
    // Story 8-2 — the chart FILLS its card on desktop (the bento cell has a
    // definite height) and is a fixed 220 px tall on the mobile auto-height
    // column. The SVG scales to its box (`height="100%"`, default `meet` keeps
    // the markers round) so a short cell scales the chart down instead of
    // letting the fixed-height plot bleed out the bottom of the card — the
    // overflow seen when the Hypothèse widget is sized to a single row.
    <View flexDirection="column" $lg={{ flex: 1, minHeight: 0 }}>
      <View height={height} $lg={{ flex: 1, minHeight: 0 }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          style={{ display: "block" }}
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
