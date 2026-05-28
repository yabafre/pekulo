"use client";

// Patrimoine view — `?tab=patrimoine` on /dashboard. Mirrors ux-preview
// PatrimoineView (App.tsx:359-377): flat single-column with gap-10,
// centred max-w-3xl on lg+. Hero + accounts + composition + activity.
// Composition + Activity ship as inline flat placeholders here (NOT
// PlaceholderCard, which wraps in Section → card). Real data lands with
// stories 3-x / 4-x (breakdown) + 5-x (transactions).

import { View, Text } from "@pekulo/ui/client";
import { useAccounts } from "../_accounts/_hooks/use-accounts";
import { AccountsSection } from "../_accounts/_components/accounts-section";
import { BankConnectionsSection } from "../parametres/_components/bank-connections-section";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function SkeletonLine({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  if (typeof width === "string") {
    return <View style={{ width, height }} backgroundColor="$backgroundMuted" borderRadius="$sm" />;
  }
  return (
    <View width={width} height={height} backgroundColor="$backgroundMuted" borderRadius="$sm" />
  );
}

function FlatListPlaceholder({ rows, ownerStory }: { rows: number; ownerStory: string }) {
  const keys = ["a", "b", "c", "d", "e"].slice(0, rows);
  return (
    <View flexDirection="column" gap="$3">
      {keys.map((k) => (
        <View
          key={`row-${k}`}
          flexDirection="row"
          alignItems="center"
          gap="$3"
          paddingVertical="$2"
        >
          <View width={28} height={28} borderRadius="$full" backgroundColor="$backgroundMuted" />
          <View flex={1} flexDirection="column" gap="$1">
            <SkeletonLine width="60%" height={12} />
            <SkeletonLine width="30%" height={10} />
          </View>
          <SkeletonLine width={60} height={12} />
        </View>
      ))}
      <View flexDirection="row" justifyContent="flex-end" marginTop="$1">
        <Text color="$colorMuted" fontSize="$xs">
          Bientôt · {ownerStory}
        </Text>
      </View>
    </View>
  );
}

export function PatrimoineView() {
  const { data } = useAccounts();
  const accounts = data ?? [];
  const totalLiquide = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);

  return (
    <View
      flexDirection="column"
      gap="$10"
      width="100%"
      $lg={{ maxWidth: 768, marginHorizontal: "auto" }}
    >
      <View render="section" aria-label="Patrimoine total">
        <Text color="$colorTertiary" fontSize="$caption">
          Total
        </Text>
        <Text
          color="$color"
          fontSize="$h1"
          fontWeight="600"
          letterSpacing={-0.5}
          marginTop="$2"
          $lg={{ fontSize: "$hero" }}
        >
          {eur0.format(totalLiquide)}
        </Text>
        <Text color="$colorTertiary" fontSize="$bodySm" marginTop="$2">
          {`${eurCompact.format(totalLiquide)} € liquide · — placé · — immobilier`}
        </Text>
      </View>

      <AccountsSection />

      <BankConnectionsSection />

      <View render="section" aria-labelledby="comp-h" flexDirection="column">
        <Text
          id="comp-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
          $lg={{ fontSize: "$h2" }}
        >
          Composition
        </Text>
        <FlatListPlaceholder rows={3} ownerStory="3-x / 4-x" />
      </View>

      <View render="section" aria-labelledby="act-h" flexDirection="column">
        <Text
          id="act-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
          $lg={{ fontSize: "$h2" }}
        >
          Activité récente
        </Text>
        <FlatListPlaceholder rows={5} ownerStory="5-x" />
      </View>
    </View>
  );
}
