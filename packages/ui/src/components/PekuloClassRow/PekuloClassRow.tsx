"use client";

import { Text, View } from "tamagui";
import { PekuloDonut } from "../PekuloDonut";

export interface PekuloClassRowProps {
  label: string;
  amountEur: number;
  pct: number;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function PekuloClassRow({ label, amountEur, pct }: PekuloClassRowProps) {
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <PekuloDonut pct={pct} size={28} stroke={3} />
      <Text color="$color" fontSize="$bodySm" fontWeight="500" flex={1}>
        {label}
      </Text>
      <Text color="$color" fontSize="$bodySm" fontWeight="500">
        {eur0.format(amountEur)}
      </Text>
      <Text color="$colorTertiary" fontSize="$xs">
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
}
