"use client";

import { Text, View } from "tamagui";
import { Check } from "lucide-react";

export interface PekuloMonthlyRecord {
  monthLabel: string;
  incomeEur: number;
  spendingEur: number;
  netEur: number;
  closed?: boolean;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloMonthlyRowProps {
  month: PekuloMonthlyRecord;
}

export function PekuloMonthlyRow({ month }: PekuloMonthlyRowProps) {
  const sign = month.netEur >= 0 ? "+" : "−";
  const tone = month.netEur >= 0 ? "$success" : "$danger";
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <View flex={1}>
        <Text
          color="$color"
          fontSize="$bodySm"
          fontWeight="500"
          textTransform="capitalize"
        >
          {month.monthLabel}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          +{eur0.format(month.incomeEur)} · −{eur0.format(month.spendingEur)}
        </Text>
      </View>
      <Text color={tone as never} fontSize="$bodySm" fontWeight="500">
        {sign}
        {eur0.format(Math.abs(month.netEur))}
      </Text>
      {month.closed && (
        <View
          flexDirection="row"
          alignItems="center"
          gap="$1"
          paddingHorizontal="$2"
          paddingVertical={3}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
        >
          <Check size={12} color="currentColor" />
          <Text color="$colorSecondary" fontSize="$11">
            Clôturé
          </Text>
        </View>
      )}
    </View>
  );
}
