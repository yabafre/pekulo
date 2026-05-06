"use client";

import { Text, View } from "tamagui";
import { PekuloDonut } from "./PekuloDonut";

export interface PekuloCompositionRowProps {
  label: string;
  amount: number;
  pct: number;
  sub?: string;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function PekuloCompositionRow({ label, amount, pct, sub }: PekuloCompositionRowProps) {
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical={10}>
      <PekuloDonut pct={pct} size={28} stroke={3} />
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {label}
        </Text>
        {sub && (
          <Text color="$colorTertiary" fontSize="$xs">
            {sub}
          </Text>
        )}
      </View>
      <View alignItems="flex-end">
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {eur0.format(amount)}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {Math.round(pct * 100)}%
        </Text>
      </View>
    </View>
  );
}
