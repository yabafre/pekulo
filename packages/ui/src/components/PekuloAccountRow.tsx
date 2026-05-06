"use client";

import { Text, View } from "tamagui";

export type PekuloAccountType = "livret" | "pea" | "cto" | "av" | "autre";

export interface PekuloAccountRowProps {
  label: string;
  type: PekuloAccountType;
  institution?: string;
  balanceEur: number;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const TYPE_LABEL: Record<PekuloAccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
};

export function PekuloAccountRow({
  label,
  type,
  institution,
  balanceEur,
}: PekuloAccountRowProps) {
  const sub = institution ? `${TYPE_LABEL[type]} · ${institution}` : TYPE_LABEL[type];
  return (
    <View
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingVertical="$3"
    >
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {label}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {sub}
        </Text>
      </View>
      <Text color="$color" fontSize="$bodySm" fontWeight="500">
        {eur0.format(balanceEur)}
      </Text>
    </View>
  );
}
