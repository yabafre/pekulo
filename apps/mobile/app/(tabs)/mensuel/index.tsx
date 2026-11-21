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

export default function MensuelScreen() {
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
    ? formatMonthKey(`${current.year}-${String(current.monthNum).padStart(2, "0")}`)
    : "";

  function openMonthActions(year: number, monthNum: number, label: string) {
    showActions(label, [
      {
        label: "Rouvrir le mois",
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: `Rouvrir ${label} ?`,
            message: "Le mois redevient modifiable et devra être clôturé à nouveau.",
            confirmLabel: "Rouvrir",
            onConfirm: () => {
              void run(() => reopen.mutateAsync({ year, monthNum }), `${label} rouvert`);
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
          title="Impossible de charger le suivi mensuel"
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
              label="Épargne nette"
              value={viewData.currentNetFormatted}
              tone={viewData.currentNetTone}
            />
            <View flexDirection="row" gap="$4">
              <View flex={1}>
                <PekuloStat label="Entrées" value={viewData.currentIncomeFormatted} tone="gain" />
              </View>
              <View flex={1}>
                <PekuloStat label="Sorties" value={viewData.currentSpendingFormatted} />
              </View>
            </View>
          </View>

          {current ? (
            <View gap="$2">
              <Pressable
                testID="cloture-btn"
                accessibilityRole="button"
                accessibilityLabel={`Clôturer ${currentLabel}`}
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
                      ? `${currentLabel} est clôturé`
                      : `Clôturer ${currentLabel.toLowerCase()}`}
                  </Text>
                </View>
              </Pressable>
              {!current.signedOff && !canClose ? (
                <Text color="$colorTertiary" fontSize="$xs" textAlign="center">
                  Clôture possible du {closeWindowLabel(current.year, current.monthNum)}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Section flat title="Historique" ariaLabel="Historique mensuel">
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
                    accessibilityHint="Ouvre les actions du mois"
                    onPress={() => openMonthActions(key.year, key.monthNum, month.monthLabel)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloMonthlyRow month={month} />
                  </Pressable>
                ) : (
                  <PekuloMonthlyRow key={rowId} month={month} />
                );
              })
            ) : (
              <PekuloEmptyState
                icon={Calendar}
                title="Aucun bilan mensuel"
                message="Vos bilans et clôtures mensuels apparaîtront ici dès que des transactions seront enregistrées."
              />
            )}
          </Section>
        </View>
      )}
    </ScreenShell>
  );
}
