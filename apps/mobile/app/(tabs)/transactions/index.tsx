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
import { useI18n } from "../../../lib/i18n";
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
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        direction === "prev" ? t("transactions.prevMonth") : t("transactions.nextMonth")
      }
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
  const { t, lang, locale } = useI18n();
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

  // French keeps the singular for 0 and 1 ("0 résultat"); English only for 1.
  const resultCount = filteredRows.length;
  const resultSingular = lang === "fr" ? resultCount <= 1 : resultCount === 1;
  const resultTitle = t(
    resultSingular ? "transactions.list.resultOne" : "transactions.list.resultOther",
    { count: resultCount },
  );

  function openRowActions(id: string, label: string) {
    showActions(label, [
      {
        label: t("common.actions.edit"),
        onPress: () => router.push(`/sheets/transaction?id=${id}&month=${month}`),
      },
      {
        label: t("common.actions.delete"),
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: t("transactions.delete.title"),
            message: t("transactions.delete.message"),
            confirmLabel: t("common.actions.delete"),
            onConfirm: () => {
              void run(
                () => mutations.remove.mutateAsync({ id }),
                t("transactions.toasts.deleted"),
              );
            },
          }),
      },
    ]);
  }

  return (
    <>
      <TabToolbar
        addLabel={t("transactions.newTransaction")}
        onAdd={() => router.push(`/sheets/transaction?month=${month}`)}
      />
      <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("transactions.search.placeholder")}
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
              {formatMonthKey(month, locale)}
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
            title={t("transactions.loadError")}
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
                  label={t("transactions.stats.monthBalance")}
                  value={viewData.netFormatted}
                  tone={viewData.netTone}
                />
                <View flexDirection="row" gap="$4">
                  <View flex={1}>
                    <PekuloStat
                      label={t("transactions.stats.income")}
                      value={viewData.incomeFormatted}
                      tone="gain"
                    />
                  </View>
                  <View flex={1}>
                    <PekuloStat
                      label={t("transactions.stats.spending")}
                      value={viewData.spendingFormatted}
                    />
                  </View>
                </View>
              </View>
            )}

            {!searching && viewData.pendingSuggestions.length > 0 && (
              <Section
                flat
                title={t("transactions.suggestions.title")}
                ariaLabel={t("transactions.suggestions.aria")}
                action={
                  <Text
                    color="$colorTertiary"
                    fontSize="$xs"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {t("transactions.suggestions.toValidate", {
                      count: viewData.pendingSuggestions.length,
                    })}
                  </Text>
                }
              >
                {viewData.pendingSuggestions.map((item) => (
                  <PekuloSuggestionRow
                    key={item.id}
                    tx={item.suggestion}
                    disabled={confirmMutation.isPending}
                    labels={{
                      confirm: t("transactions.suggestions.confirm"),
                      confirmAria: t("transactions.suggestions.confirmAria"),
                      editAria: t("transactions.suggestions.editAria"),
                    }}
                    onEdit={() =>
                      showActions(
                        t("transactions.suggestions.chooseCategory"),
                        options.suggestableCategories.map((option) => ({
                          label: option.label,
                          onPress: () => {
                            void run(
                              () =>
                                confirmMutation.mutateAsync({
                                  id: item.id,
                                  category: option.value,
                                }),
                              t("transactions.suggestions.categoryUpdated"),
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
                            toast.success(
                              t("transactions.suggestions.categoryConfirmed"),
                              item.suggestion.label,
                            );
                          },
                          onError: () => {
                            toast.danger(
                              t("transactions.suggestions.confirmFailedTitle"),
                              t("transactions.suggestions.confirmFailedMessage"),
                            );
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
              title={searching ? resultTitle : t("transactions.list.recentTitle")}
              ariaLabel={t("transactions.list.recentAria")}
            >
              {filteredRows.length > 0 ? (
                filteredRows.map(({ id, activity }) => (
                  <Pressable
                    key={id}
                    testID={`tx-row-${id}`}
                    accessibilityRole="button"
                    accessibilityHint={t("transactions.list.rowHint")}
                    onPress={() => openRowActions(id, activity.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloActivityRow tx={activity} />
                  </Pressable>
                ))
              ) : normalizedQuery ? (
                <PekuloEmptyState
                  icon={Search}
                  title={t("transactions.list.noResultsTitle")}
                  message={t("transactions.list.noResultsMessage", { query: searchQuery.trim() })}
                />
              ) : (
                <PekuloEmptyState
                  icon={Receipt}
                  title={t("transactions.list.emptyTitle")}
                  message={t("transactions.list.emptyMessage")}
                  ctaLabel={t("transactions.list.emptyCta")}
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
