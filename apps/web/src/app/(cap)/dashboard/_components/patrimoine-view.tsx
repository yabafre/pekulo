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
import { BankConnectionsSection } from "../_bank/_components/bank-connections-section";
import { CompositionSection } from "./composition-section";
import { RecentActivitySection } from "./recent-activity-section";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

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

      <CompositionSection variant="flat" />

      <RecentActivitySection variant="flat" />
    </View>
  );
}
