"use client";

import { Text, View } from "tamagui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface PekuloActivity {
  label: string;
  account: string;
  category: string;
  direction: "in" | "out";
  amountEur: number;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloActivityRowProps {
  tx: PekuloActivity;
}

export function PekuloActivityRow({ tx }: PekuloActivityRowProps) {
  const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
  const arrowColor = tx.direction === "in" ? "var(--success)" : "var(--colorTertiary)";
  const sign = tx.direction === "in" ? "+" : "−";
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical={10}>
      <Arrow size={18} color={arrowColor} />
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {tx.label}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {tx.account} · {tx.category}
        </Text>
      </View>
      <Text color="$color" fontSize="$bodySm" fontWeight="500">
        {sign}
        {eur0.format(tx.amountEur)}
      </Text>
    </View>
  );
}
