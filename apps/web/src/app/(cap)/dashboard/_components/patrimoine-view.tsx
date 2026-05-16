"use client";

// Patrimoine view — `?tab=patrimoine` on /dashboard. Hero = total liquide
// (delta arrives with story 7-1). Composition + Recent activity stay
// placeheld pending stories 3-x / 5-x — mirrors story 1-4's Cap view.

import { View } from "@pekulo/ui/client";
import { PekuloHero, PekuloAccountsSection } from "@pekulo/ui";
import type { AccountCardItem, AccountType } from "@pekulo/types";
import type { Account } from "@pekulo/validators";
import { useAccounts } from "../parametres/_hooks/use-accounts";
import { PlaceholderCard } from "./placeholder-card";

function toCardItem(acc: Account): AccountCardItem {
  return {
    label: acc.label,
    type: acc.type as AccountType,
    // institution intentionally omitted — not part of the live Account schema.
    balanceEur: acc.cashBalance,
  };
}

export function PatrimoineView() {
  const { data, isLoading, error } = useAccounts();
  const accounts = data ?? [];
  const totalLiquide = accounts.reduce((sum, acc) => sum + acc.cashBalance, 0);
  const items = accounts.map(toCardItem);

  return (
    <View flexDirection="column" gap="$6" width="100%" maxWidth={920} marginHorizontal="auto">
      <View padding="$5" backgroundColor="$backgroundCard" borderRadius="$xl">
        <PekuloHero variant="mobile" totalEur={totalLiquide} aheadEur={0} label="Liquide" />
      </View>

      {isLoading && (
        <View padding="$4">
          <PlaceholderCard variant="composition" ownerStory="chargement comptes…" />
        </View>
      )}
      {error && !isLoading && (
        <View padding="$4">
          <PlaceholderCard variant="composition" ownerStory={`Erreur — ${error.message}`} />
        </View>
      )}
      {!isLoading && !error && <PekuloAccountsSection accounts={items} />}

      <PlaceholderCard variant="composition" ownerStory="5-x" />
      <PlaceholderCard variant="activity" ownerStory="5-x" />
    </View>
  );
}
