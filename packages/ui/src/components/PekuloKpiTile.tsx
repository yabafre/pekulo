"use client";

// packages/ui/src/components/PekuloKpiTile.tsx
// Mobile mini-KPI card. Label top, optional mini-donut top-right, value
// bottom-left, sub-caption bottom.

import { Text, View } from "tamagui";
import { PekuloDonut } from "./PekuloDonut";

export interface PekuloKpiTileProps {
  label: string;
  valueTop: string;
  valueBottom?: string;
  /** Optional progress fraction (0..1) — shows a 32px donut top-right. */
  progress?: number;
}

export function PekuloKpiTile({ label, valueTop, valueBottom, progress }: PekuloKpiTileProps) {
  return (
    <View backgroundColor="$backgroundCard" borderRadius="$lg" padding="$4" flex={1} minWidth={140}>
      <View flexDirection="row" justifyContent="space-between" alignItems="flex-start">
        <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
          {label}
        </Text>
        {progress !== undefined && <PekuloDonut pct={progress} size={32} stroke={3} />}
      </View>
      <Text color="$color" fontSize="$h2" fontWeight="600" marginTop="$3">
        {valueTop}
      </Text>
      {valueBottom && (
        <Text color="$colorTertiary" fontSize="$xs" marginTop={2}>
          {valueBottom}
        </Text>
      )}
    </View>
  );
}
