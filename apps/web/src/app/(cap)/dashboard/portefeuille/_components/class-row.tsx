"use client";

import { View, Text } from "@pekulo/ui/client";
import { PekuloDonut } from "@pekulo/ui";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface ClassRowProps {
  label: string;
  amount: number;
  pct: number;
}

export function ClassRow({ label, amount, pct }: ClassRowProps) {
  return (
    <View render="li" flexDirection="row" alignItems="center" gap="$4" paddingVertical={10}>
      <PekuloDonut
        pct={pct}
        size={24}
        stroke={2.5}
        ariaLabel={`${label} ${(pct * 100).toFixed(0)} %`}
      />
      <Text flex={1} color="$color" fontSize="$bodySm">
        {label}
      </Text>
      <Text color="$color" fontSize="$bodySm" fontVariant={["tabular-nums"]} flexShrink={0}>
        {eur0.format(amount)}
      </Text>
      <Text
        color="$colorTertiary"
        fontSize="$caption"
        fontVariant={["tabular-nums"]}
        width={40}
        textAlign="right"
        flexShrink={0}
      >
        {(pct * 100).toFixed(0)} %
      </Text>
    </View>
  );
}
