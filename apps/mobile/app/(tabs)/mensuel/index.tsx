// apps/mobile/app/(tabs)/mensuel/index.tsx
// Mobile Mensuel screen inside a native iOS Large Title Stack: renders current
// month savings (`Épargne nette`, `Entrées`, `Sorties`), flat monthly history
// rows (`PekuloMonthlyRow`), pull-to-refresh, and loading/error/empty states.

import { PekuloEmptyState, PekuloMonthlyRow, PekuloStat, Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { Calendar } from "lucide-react-native";

import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { useAuth } from "../../../lib/auth/auth-context";
import { useMobileMonthlyData } from "../../../lib/hooks/use-mobile-queries";

export default function MensuelScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileMonthlyData();

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    currentNetFormatted: "+1 240 €",
    currentNetTone: "gain" as const,
    currentIncomeFormatted: "+3 400 €",
    currentSpendingFormatted: "−2 160 €",
    months: [],
  };

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
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

          <Section flat title="Historique" ariaLabel="Historique mensuel">
            {viewData.months.length > 0 ? (
              viewData.months.map((month) => (
                <PekuloMonthlyRow key={month.monthLabel} month={month} />
              ))
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
