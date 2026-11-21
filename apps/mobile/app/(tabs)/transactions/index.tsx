// apps/mobile/app/(tabs)/transactions/index.tsx
// Mobile Transactions screen inside a native iOS Large Title Stack with a
// native `Stack.SearchBar`, pull-to-refresh, toast feedback on 1-tap AI
// suggestion confirmation, and full loading/error/empty states.

import {
  PekuloActivityRow,
  PekuloEmptyState,
  PekuloStat,
  PekuloSuggestionRow,
  Section,
  useToast,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import Stack from "expo-router/stack";
import { Receipt, Search } from "lucide-react-native";
import { useMemo, useState } from "react";

import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useConfirmMobileSuggestion,
  useMobileTransactionsData,
} from "../../../lib/hooks/use-mobile-queries";

export default function TransactionsScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileTransactionsData();
  const confirmMutation = useConfirmMobileSuggestion();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    monthLabel: "2026-05",
    netFormatted: "+1 050 €",
    netTone: "gain" as const,
    incomeFormatted: "+3 200 €",
    spendingFormatted: "−2 150 €",
    pendingSuggestions: [],
    recentTransactions: [],
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTransactions = useMemo(() => {
    if (!normalizedQuery) return viewData.recentTransactions;
    return viewData.recentTransactions.filter(
      (tx) =>
        tx.label.toLowerCase().includes(normalizedQuery) ||
        tx.account.toLowerCase().includes(normalizedQuery) ||
        tx.category.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, viewData.recentTransactions]);

  return (
    <>
      <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
        {showLoading ? (
          <ScreenLoadingSkeleton sections={2} />
        ) : showError ? (
          <ScreenErrorState
            title="Impossible de charger vos transactions"
            onRetry={() => {
              void refetch();
            }}
          />
        ) : (
          <View gap="$8">
            <View
              backgroundColor="$backgroundCard"
              borderRadius="$xl"
              padding="$5"
              gap="$4"
              style={{ borderCurve: "continuous" }}
            >
              <PekuloStat
                label="Solde du mois"
                value={viewData.netFormatted}
                tone={viewData.netTone}
              />
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
              <Section
                flat
                title="Suggestions IA"
                ariaLabel="Suggestions IA à confirmer"
                action={
                  <Text
                    color="$colorTertiary"
                    fontSize="$xs"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {viewData.pendingSuggestions.length} à valider
                  </Text>
                }
              >
                {viewData.pendingSuggestions.map((item) => (
                  <PekuloSuggestionRow
                    key={item.id}
                    tx={item.suggestion}
                    disabled={confirmMutation.isPending}
                    onConfirm={() => {
                      confirmMutation.mutate(
                        {
                          id: item.id,
                          category: item.rawCategory,
                        },
                        {
                          onSuccess: () => {
                            toast.success("Catégorie confirmée", item.suggestion.label);
                          },
                          onError: () => {
                            toast.danger("Confirmation impossible", "Réessayez dans un instant.");
                          },
                        },
                      );
                    }}
                  />
                ))}
              </Section>
            )}

            <Section flat title="Récentes" ariaLabel="Transactions récentes">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <PekuloActivityRow
                    key={`${tx.label}-${tx.account}-${tx.category}-${tx.direction}-${tx.amountEur}`}
                    tx={tx}
                  />
                ))
              ) : normalizedQuery ? (
                <PekuloEmptyState
                  icon={Search}
                  title="Aucun résultat"
                  message={`Aucune transaction ne correspond à « ${searchQuery.trim()} ».`}
                />
              ) : (
                <PekuloEmptyState
                  icon={Receipt}
                  title="Aucune transaction"
                  message="Aucune transaction enregistrée sur la période."
                />
              )}
            </Section>
          </View>
        )}
      </ScreenShell>
      <Stack.SearchBar
        placeholder="Rechercher une transaction"
        cancelButtonText="Annuler"
        hideWhenScrolling={false}
        placement="stacked"
        onChangeText={(event) => setSearchQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearchQuery("")}
      />
    </>
  );
}
