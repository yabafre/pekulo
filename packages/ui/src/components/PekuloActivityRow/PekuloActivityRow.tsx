"use client";

import { Text, View } from "tamagui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Activity } from "@pekulo/types";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloActivityRowProps {
  tx: Activity;
}

export function PekuloActivityRow({ tx }: PekuloActivityRowProps) {
  const isInflow = tx.direction === "in";
  const Arrow = isInflow ? ArrowDownRight : ArrowUpRight;
  const arrowColor = isInflow ? "var(--success)" : "var(--colorTertiary)";
  // Inflow amounts share the success accent with the arrow (matches
  // ux-preview ActivityRow at App.tsx:1099 — `isInflow ? "text-gain"
  // : "text-fg"`). TR fidelity rule: emerald lives only on positive
  // perf deltas ; outflow stays default neutral.
  const amountColor = isInflow ? "$success" : "$color";
  const sign = isInflow ? "+" : "−";
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <Arrow size={18} color={arrowColor} />
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {tx.label}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {tx.account} · {tx.category}
        </Text>
      </View>
      <Text color={amountColor} fontSize="$bodySm" fontWeight="500">
        {sign}
        {eur0.format(tx.amountEur)}
      </Text>
    </View>
  );
}
