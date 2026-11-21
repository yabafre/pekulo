// apps/mobile/app/(tabs)/transactions/index.tsx
// Mobile Transactions screen inside a native iOS Large Title Stack with an
// in-content iOS search field, month navigation, pull-to-refresh, toast feedback on 1-tap AI
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
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Receipt, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable } from "react-native";
import { useTheme } from "tamagui";

import { useMutationRunner } from "../../../components/form/sheet";
import { ScreenShell } from "../../../components/screen-shell";
import { SearchField } from "../../../components/search-field";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { TabToolbar } from "../../../components/tab-stack-layout";
import { confirmDestructive, showActions } from "../../../lib/actions";
import { useAuth } from "../../../lib/auth/auth-context";
import { currentMonthKey, formatMonthKey, shiftMonthKey } from "../../../lib/forms";
import { useTransactionMutations } from "../../../lib/hooks/use-mobile-mutations";
import { useMobileTransactionsData } from "../../../lib/hooks/use-mobile-queries";
import { useOptions } from "../../../lib/options";

function MonthStepButton({
  direction,
  disabled,
  onPress,
}: {
  direction: "prev" | "next";
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === "prev" ? "Mois précédent" : "Mois suivant"}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      testID={direction === "prev" ? "month-prev-btn" : "month-next-btn"}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={direction === "prev" ? "chevron.left" : "chevron.right"}
        size={17}
        weight="semibold"
        tintColor={theme.color.val}
        fallback={
          <Text color="$color" fontSize="$h3">
            {direction === "prev" ? "‹" : "›"}
          </Text>
        }
      />
    </Pressable>
  );
}

export default function TransactionsScreen() {
  const options = useOptions();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const thisMonth = currentMonthKey();
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, isError, isRefetching, refetch } = useMobileTransactionsData(month);
  const mutations = useTransactionMutations();
  const confirmMutation = mutations.confirmCategory;
  const { run } = useMutationRunner();
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
    rows: [],
    accountOptions: [],
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  // While searching, only the matching rows are shown (no month header,
  // summary or suggestions competing with the results).
  const searching = normalizedQuery.length > 0;
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return viewData.rows;
    return viewData.rows.filter(
      ({ activity: tx }) =>
        tx.label.toLowerCase().includes(normalizedQuery) ||
        tx.account.toLowerCase().includes(normalizedQuery) ||
        tx.category.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, viewData.rows]);

  function openRowActions(id: string, label: string) {
    showActions(label, [
      {
        label: "Modifier",
        onPress: () => router.push(`/sheets/transaction?id=${id}&month=${month}`),
      },
      {
        label: "Supprimer",
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: "Supprimer la transaction ?",
            message: "Elle sera retirée de vos totaux. Cette action est définitive.",
            confirmLabel: "Supprimer",
            onConfirm: () => {
              void run(() => mutations.remove.mutateAsync({ id }), "Transaction supprimée");
            },
          }),
      },
    ]);
  }

  return (
    <>
      <TabToolbar
        addLabel="Nouvelle transaction"
        onAdd={() => router.push(`/sheets/transaction?month=${month}`)}
      />
      <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher une transaction"
          testID="tx-search"
        />
        {searching ? null : (
          <View flexDirection="row" alignItems="center" justifyContent="space-between">
            <MonthStepButton
              direction="prev"
              onPress={() => setMonth((m) => shiftMonthKey(m, -1))}
            />
            <Text
              color="$color"
              fontSize="$body"
              fontWeight="600"
              accessibilityRole="header"
              testID="month-label"
            >
              {formatMonthKey(month)}
            </Text>
            <MonthStepButton
              direction="next"
              disabled={month >= thisMonth}
              onPress={() => setMonth((m) => shiftMonthKey(m, 1))}
            />
          </View>
        )}
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
            {searching ? null : (
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
            )}

            {!searching && viewData.pendingSuggestions.length > 0 && (
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
                    onEdit={() =>
                      showActions(
                        "Choisir la catégorie",
                        options.suggestableCategories.map((option) => ({
                          label: option.label,
                          onPress: () => {
                            void run(
                              () =>
                                confirmMutation.mutateAsync({
                                  id: item.id,
                                  category: option.value,
                                }),
                              "Catégorie mise à jour",
                            );
                          },
                        })),
                        item.suggestion.label,
                      )
                    }
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

            <Section
              flat
              title={
                searching
                  ? `${filteredRows.length} résultat${filteredRows.length > 1 ? "s" : ""}`
                  : "Récentes"
              }
              ariaLabel="Transactions récentes"
            >
              {filteredRows.length > 0 ? (
                filteredRows.map(({ id, activity }) => (
                  <Pressable
                    key={id}
                    testID={`tx-row-${id}`}
                    accessibilityRole="button"
                    accessibilityHint="Ouvre les actions de la transaction"
                    onPress={() => openRowActions(id, activity.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloActivityRow tx={activity} />
                  </Pressable>
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
                  ctaLabel="Ajouter une transaction"
                  onCta={() => router.push(`/sheets/transaction?month=${month}`)}
                />
              )}
            </Section>
          </View>
        )}
      </ScreenShell>
    </>
  );
}
