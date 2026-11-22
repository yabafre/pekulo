// apps/mobile/app/(tabs)/mensuel/index.tsx
// Mobile Mensuel screen inside a native iOS Large Title Stack: renders current
// month savings (`Épargne nette`, `Entrées`, `Sorties`), flat monthly history
// rows (`PekuloMonthlyRow`), pull-to-refresh, and loading/error/empty states.

import { PekuloEmptyState, PekuloMonthlyRow, PekuloStat, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { Calendar } from "lucide-react-native";
import { Pressable } from "react-native";

import { useMutationRunner } from "../../../components/form/sheet";
import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { TabToolbar } from "../../../components/tab-stack-layout";
import { confirmDestructive, showActions } from "../../../lib/actions";
import { useAuth } from "../../../lib/auth/auth-context";
import { closeWindowLabel, formatMonthKey, isWithinCloseWindow, nowDate } from "../../../lib/forms";
import { useMonthlyMutations } from "../../../lib/hooks/use-mobile-mutations";
import { useMobileMonthlyData } from "../../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../../lib/i18n";

export default function MensuelScreen() {
  const { t, lang, locale } = useI18n();
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileMonthlyData();
  const router = useRouter();
  const { reopen } = useMonthlyMutations();
  const { run } = useMutationRunner();

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    currentNetFormatted: "+1 240 €",
    currentNetTone: "gain" as const,
    currentIncomeFormatted: "+3 400 €",
    currentSpendingFormatted: "−2 160 €",
    months: [],
    monthKeys: [],
    current: undefined,
  };
  const current = viewData.current;
  const canClose =
    current !== undefined &&
    !current.signedOff &&
    isWithinCloseWindow(current.year, current.monthNum, nowDate());
  const currentLabel = current
    ? formatMonthKey(`${current.year}-${String(current.monthNum).padStart(2, "0")}`, locale)
    : "";
  // Month names are lowercase mid-sentence in French, capitalised in English.
  const currentLabelInline = lang === "fr" ? currentLabel.toLowerCase() : currentLabel;

  function openMonthActions(year: number, monthNum: number, label: string) {
    showActions(label, [
      {
        label: t("monthly.reopen.action"),
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: t("monthly.reopen.title", { month: label }),
            message: t("monthly.reopen.message"),
            confirmLabel: t("monthly.reopen.confirm"),
            onConfirm: () => {
              void run(
                () => reopen.mutateAsync({ year, monthNum }),
                t("monthly.reopen.done", { month: label }),
              );
            },
          }),
      },
    ]);
  }

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
      <TabToolbar />
      {showLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : showError ? (
        <ScreenErrorState
          title={t("monthly.loadError")}
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
              label={t("monthly.stats.netSavings")}
              value={viewData.currentNetFormatted}
              tone={viewData.currentNetTone}
            />
            <View flexDirection="row" gap="$4">
              <View flex={1}>
                <PekuloStat
                  label={t("monthly.stats.income")}
                  value={viewData.currentIncomeFormatted}
                  tone="gain"
                />
              </View>
              <View flex={1}>
                <PekuloStat
                  label={t("monthly.stats.spending")}
                  value={viewData.currentSpendingFormatted}
                />
              </View>
            </View>
          </View>

          {current ? (
            <View gap="$2">
              <Pressable
                testID="cloture-btn"
                accessibilityRole="button"
                accessibilityLabel={t("monthly.close.aria", { month: currentLabel })}
                accessibilityState={{ disabled: !canClose }}
                disabled={!canClose}
                onPress={() => router.push("/sheets/cloture")}
                style={({ pressed }) => ({ opacity: !canClose ? 0.45 : pressed ? 0.7 : 1 })}
              >
                <View
                  backgroundColor={canClose ? "$color" : "$backgroundMuted"}
                  borderRadius="$xl"
                  minHeight={50}
                  alignItems="center"
                  justifyContent="center"
                  style={{ borderCurve: "continuous" }}
                >
                  <Text
                    color={canClose ? "$background" : "$colorSecondary"}
                    fontSize="$body"
                    fontWeight="600"
                  >
                    {current.signedOff
                      ? t("monthly.close.done", { month: currentLabel })
                      : t("monthly.close.cta", { month: currentLabelInline })}
                  </Text>
                </View>
              </Pressable>
              {!current.signedOff && !canClose ? (
                <Text color="$colorTertiary" fontSize="$xs" textAlign="center">
                  {t("monthly.close.windowHint", {
                    range: closeWindowLabel(current.year, current.monthNum, locale),
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Section flat title={t("monthly.history.title")} ariaLabel={t("monthly.history.aria")}>
            {viewData.months.length > 0 ? (
              viewData.months.map((month, index) => {
                const key = viewData.monthKeys[index];
                const rowId = key
                  ? `${key.year}-${String(key.monthNum).padStart(2, "0")}`
                  : month.monthLabel;
                return month.closed && key ? (
                  <Pressable
                    key={rowId}
                    testID={`month-row-${rowId}`}
                    accessibilityRole="button"
                    accessibilityHint={t("monthly.history.rowHint")}
                    onPress={() => openMonthActions(key.year, key.monthNum, month.monthLabel)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloMonthlyRow
                      month={month}
                      closedLabel={t("monthly.history.closedLabel")}
                    />
                  </Pressable>
                ) : (
                  <PekuloMonthlyRow
                    key={rowId}
                    month={month}
                    closedLabel={t("monthly.history.closedLabel")}
                  />
                );
              })
            ) : (
              <PekuloEmptyState
                icon={Calendar}
                title={t("monthly.history.emptyTitle")}
                message={t("monthly.history.emptyMessage")}
              />
            )}
          </Section>
        </View>
      )}
    </ScreenShell>
  );
}
