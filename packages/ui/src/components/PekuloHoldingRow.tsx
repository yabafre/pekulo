"use client";

import { Text, View } from "tamagui";

export type PekuloHoldingKind = "etf" | "action" | "crypto" | "autre";

export interface PekuloHolding {
  ticker: string;
  label: string;
  account: string;
  kind: PekuloHoldingKind;
  quantity: number;
  pricePerUnit: number;
  marketValueEur: number;
  pnlEur: number;
  pnlPct: number;
}

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
const KIND_LABEL: Record<PekuloHoldingKind, string> = {
  etf: "ETF",
  action: "Action",
  crypto: "Crypto",
  autre: "Autre",
};

export interface PekuloHoldingRowProps {
  holding: PekuloHolding;
}

export function PekuloHoldingRow({ holding }: PekuloHoldingRowProps) {
  const sign = holding.pnlEur >= 0 ? "+" : "−";
  const tone = holding.pnlEur >= 0 ? "$success" : "$danger";
  const pctSign = holding.pnlPct >= 0 ? "+" : "−";
  return (
    <View
      flexDirection="row"
      alignItems="flex-start"
      justifyContent="space-between"
      paddingVertical="$3"
      gap="$3"
    >
      <View flex={1}>
        <View flexDirection="row" alignItems="baseline" gap={6}>
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            {holding.ticker}
          </Text>
          <Text color="$colorTertiary" fontSize="$11" fontWeight="500">
            {KIND_LABEL[holding.kind].toUpperCase()}
          </Text>
        </View>
        <Text color="$colorTertiary" fontSize="$xs">
          {holding.label} · {holding.account}
        </Text>
        <Text color="$colorTertiary" fontSize="$11" display="none" $lg={{ display: "flex" }}>
          {holding.quantity} × {eur2.format(holding.pricePerUnit)}
        </Text>
      </View>
      <View alignItems="flex-end">
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {eur0.format(holding.marketValueEur)}
        </Text>
        <Text color={tone as never} fontSize="$xs">
          {sign}
          {eur0.format(Math.abs(holding.pnlEur))} ({pctSign}
          {Math.abs(holding.pnlPct).toFixed(1)}%)
        </Text>
      </View>
    </View>
  );
}
