"use client";

import { Text, View } from "tamagui";

export interface PekuloHypothesisVerdictProps {
  /** Capital projeté à l'horizon. */
  projectedEur: number;
  /** Cap demandé. */
  requiredEur: number;
  /** Année cible. */
  targetYear: number;
  /**
   * Story 7-4 (FR-59) — extra €/month to reach the cap. Renders the shortfall
   * line when present AND the cap is NOT reached. Omit to keep the 7-3 shape.
   */
  gapEurPerMonth?: number;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function PekuloHypothesisVerdict({
  projectedEur,
  requiredEur,
  targetYear,
  gapEurPerMonth,
}: PekuloHypothesisVerdictProps) {
  const delta = projectedEur - requiredEur;
  const sign = delta >= 0 ? "+" : "−";
  const reaches = delta >= 0;
  return (
    <View flexDirection="column" gap="$1">
      <Text color="$color" fontSize="$bodySm" fontWeight="500">
        {reaches
          ? `Tu atteins ton cap en ${targetYear}.`
          : `Tu n'atteins pas ton cap en ${targetYear}.`}
      </Text>
      <Text
        color={(reaches ? "$success" : "$danger") as never}
        fontSize="$caption"
        fontWeight="500"
      >
        {sign}
        {eur0.format(Math.abs(delta))} vs cap requis
      </Text>
      {!reaches && gapEurPerMonth != null && gapEurPerMonth > 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          Il manque {eur0.format(gapEurPerMonth)} / mois pour atteindre le cap.
        </Text>
      )}
    </View>
  );
}
