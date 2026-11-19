// apps/mobile/app/(tabs)/transactions.tsx
// Mobile Transactions screen: renders monthly flow stats (`Solde du mois`,
// `Entrées`, `Sorties`), pending AI categorisation suggestions with 1-tap
// confirm via `useConfirmMobileSuggestion()`, and recent transactions.

import { PekuloActivityRow, PekuloStat, PekuloSuggestionRow, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";
import {
  useConfirmMobileSuggestion,
  useMobileTransactionsData,
} from "../../lib/hooks/use-mobile-queries";

export default function TransactionsScreen() {
  const { data } = useMobileTransactionsData();
  const confirmMutation = useConfirmMobileSuggestion();

  const viewData = data ?? {
    monthLabel: "2026-05",
    netFormatted: "+1 050 €",
    netTone: "gain" as const,
    incomeFormatted: "+3 200 €",
    spendingFormatted: "−2 150 €",
    pendingSuggestions: [],
    recentTransactions: [],
  };

  return (
    <ScreenShell title="Transactions" subtitle="Flux mensuels et catégorisation IA">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Solde du mois" value={viewData.netFormatted} tone={viewData.netTone} />
        <View flexDirection="row" gap="$4">
          <View flex={1}>
            <PekuloStat label="Entrées" value={viewData.incomeFormatted} tone="gain" />
          </View>
          <View flex={1}>
            <PekuloStat label="Sorties" value={viewData.spendingFormatted} />
          </View>
        </View>
      </View>

      {viewData.pendingSuggestions.length > 0 && (
        <Section title="Suggestions IA" ariaLabel="Suggestions IA à confirmer">
          {viewData.pendingSuggestions.map((item) => (
            <PekuloSuggestionRow
              key={item.id}
              tx={item.suggestion}
              disabled={confirmMutation.isPending}
              onConfirm={() => {
                confirmMutation.mutate({
                  id: item.id,
                  category: item.rawCategory,
                });
              }}
            />
          ))}
        </Section>
      )}

      <Section title="Récentes" ariaLabel="Transactions récentes">
        {viewData.recentTransactions.length > 0 ? (
          viewData.recentTransactions.map((tx) => (
            <PekuloActivityRow
              key={`${tx.label}-${tx.account}-${tx.category}-${tx.direction}-${tx.amountEur}`}
              tx={tx}
            />
          ))
        ) : (
          <Text color="$colorSecondary" fontSize="$bodySm">
            Aucune transaction enregistrée sur la période.
          </Text>
        )}
      </Section>
    </ScreenShell>
  );
}
