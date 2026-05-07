"use client";

import { Text, View } from "tamagui";
import type { Account, AccountType } from "@pekulo/types";

// Component props — re-export the domain shape (architecture L366: domain
// types live in @pekulo/types, not inlined per component).
export type PekuloAccountRowProps = Account;

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const TYPE_LABEL: Record<AccountType, string> = {
  livret: "Livret",
  pea: "PEA",
  cto: "CTO",
  av: "Assurance vie",
  autre: "Autre",
};

export function PekuloAccountRow({ label, type, institution, balanceEur }: PekuloAccountRowProps) {
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
