"use client";

import { Text, View } from "tamagui";

export interface PekuloHypothesisVerdictProps {
  /** Capital projeté à l'horizon. */
  projectedEur: number;
  /** Cap demandé. */
  requiredEur: number;
  /** Année cible. */
  targetYear: number;
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
    </View>
  );
}
