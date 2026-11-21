"use client";

import { Text, View } from "tamagui";
import type { PropertyCardItem } from "@pekulo/types";
import { PekuloDonut } from "../PekuloDonut";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloPropertyCardProps {
  property: PropertyCardItem;
  /** Localised labels (defaults are the historical French strings). */
  labels?: {
    valuation?: string;
    equity?: string;
    debt?: string;
    monthlyPayment?: (yearsRemaining: number) => string;
    repaid?: (pct: number) => string;
  };
  /** Hide the payment block when the property has no mortgage data. */
  hideEmptyMortgage?: boolean;
}

export function PekuloPropertyCard({
  property,
  labels,
  hideEmptyMortgage = false,
}: PekuloPropertyCardProps) {
  const equity = property.valuationEur - property.debtRemainingEur;
  const showPayment = !hideEmptyMortgage || property.monthlyPaymentEur > 0;
  return (
    <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5">
      <Text color="$color" fontSize="$h3" fontWeight="600">
        {property.label}
      </Text>
      <View flexDirection="column" $lg={{ flexDirection: "row" }} gap="$5" marginTop="$4">
        <View flex={1}>
          <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
            {labels?.valuation ?? "VALORISATION"}
          </Text>
          <Text color="$color" fontSize="$h2" fontWeight="600" marginTop="$1">
            {eur0.format(property.valuationEur)}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs" marginTop="$2">
            {labels?.equity ?? "EQUITY"}
          </Text>
          <Text color="$color" fontSize="$h3" fontWeight="500">
            {eur0.format(equity)}
          </Text>
        </View>
        <View flex={1}>
          <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
            {labels?.debt ?? "DETTE RESTANTE"}
          </Text>
          <Text color="$color" fontSize="$h3" fontWeight="500" marginTop="$1">
            {eur0.format(property.debtRemainingEur)}
          </Text>
          {showPayment ? (
            <>
              <Text color="$colorTertiary" fontSize="$xs" marginTop="$2">
                {labels?.monthlyPayment
                  ? labels.monthlyPayment(property.yearsRemaining)
                  : `MENSUALITÉ · ${property.yearsRemaining} ans restants`}
              </Text>
              <Text color="$color" fontSize="$bodySm" fontWeight="500">
                {eur0.format(property.monthlyPaymentEur)}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View flexDirection="row" alignItems="center" gap="$3" marginTop="$4" paddingTop="$4">
        <PekuloDonut pct={property.repaidPct} size={32} stroke={3} />
        <Text color="$colorSecondary" fontSize="$caption">
          {labels?.repaid
            ? labels.repaid(Math.round(property.repaidPct * 100))
            : `${Math.round(property.repaidPct * 100)}% remboursé`}
        </Text>
      </View>
    </View>
  );
}
