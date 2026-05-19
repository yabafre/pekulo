"use client";

import { View, Text } from "@pekulo/ui/client";
import type { Holding } from "@pekulo/validators";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function signed(amount: number): string {
  return `${amount >= 0 ? "+" : ""}${eur0.format(amount)}`;
}

export interface HoldingRowProps {
  holding: Holding;
  accountLabel: string | null;
  marketValueEur: number;
  unrealisedPnlEur: number;
  unrealisedPnlPct: number;
  /** Optional kebab menu (passed in by parent — keeps the row free of dialog state). */
  trailing?: React.ReactNode;
}

export function HoldingRow({
  holding,
  accountLabel,
  marketValueEur,
  unrealisedPnlEur,
  unrealisedPnlPct,
  trailing,
}: HoldingRowProps) {
  const isGain = unrealisedPnlEur >= 0;
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <View flex={1} flexDirection="column" minWidth={0}>
        <View flexDirection="row" alignItems="baseline" gap="$2">
          <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
            {holding.ticker ?? holding.label}
          </Text>
          <Text color="$colorMuted" fontSize={11} textTransform="uppercase" letterSpacing={1}>
            {holding.kind}
          </Text>
        </View>
        <Text
          color="$colorTertiary"
          fontSize="$caption"
          fontVariant={["tabular-nums"]}
          numberOfLines={1}
        >
          {holding.label} · {accountLabel ?? "—"}
        </Text>
        <Text
          display="none"
          $lg={{ display: "flex" }}
          color="$colorMuted"
          fontSize="$caption"
          fontVariant={["tabular-nums"]}
        >
          {holding.quantity} × {eur2.format(holding.lastPrice)}
        </Text>
      </View>
      <View flexDirection="column" alignItems="flex-end">
        <Text color="$color" fontSize="$bodySm" fontWeight="500" fontVariant={["tabular-nums"]}>
          {eur0.format(marketValueEur)}
        </Text>
        <Text
          color={isGain ? "$accent" : "$danger"}
          fontSize="$caption"
          fontVariant={["tabular-nums"]}
        >
          {signed(unrealisedPnlEur)} ({(unrealisedPnlPct * 100).toFixed(2)} %)
        </Text>
      </View>
      {trailing}
    </View>
  );
}
