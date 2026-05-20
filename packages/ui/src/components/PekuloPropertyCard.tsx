"use client";

import { Text, View } from "tamagui";
import type { PropertyCardItem } from "@pekulo/types";
import { PekuloDonut } from "./PekuloDonut";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloPropertyCardProps {
  property: PropertyCardItem;
}

export function PekuloPropertyCard({ property }: PekuloPropertyCardProps) {
  const equity = property.valuationEur - property.debtRemainingEur;
  return (
    <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5">
      <Text color="$color" fontSize="$h3" fontWeight="600">
        {property.label}
      </Text>
      <View flexDirection="column" $lg={{ flexDirection: "row" }} gap="$5" marginTop="$4">
        <View flex={1}>
          <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
            VALORISATION
          </Text>
          <Text color="$color" fontSize="$h2" fontWeight="600" marginTop="$1">
            {eur0.format(property.valuationEur)}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs" marginTop="$2">
            EQUITY
          </Text>
          <Text color="$color" fontSize="$h3" fontWeight="500">
            {eur0.format(equity)}
          </Text>
        </View>
        <View flex={1}>
          <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
            DETTE RESTANTE
          </Text>
          <Text color="$color" fontSize="$h3" fontWeight="500" marginTop="$1">
            {eur0.format(property.debtRemainingEur)}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs" marginTop="$2">
            MENSUALITÉ · {property.yearsRemaining} ans restants
          </Text>
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {eur0.format(property.monthlyPaymentEur)}
          </Text>
        </View>
      </View>
      <View flexDirection="row" alignItems="center" gap="$3" marginTop="$4" paddingTop="$4">
        <PekuloDonut pct={property.repaidPct} size={32} stroke={3} />
        <Text color="$colorSecondary" fontSize="$caption">
          {Math.round(property.repaidPct * 100)}% remboursé
        </Text>
      </View>
    </View>
  );
}
