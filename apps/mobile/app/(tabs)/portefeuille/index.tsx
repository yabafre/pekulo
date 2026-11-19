// apps/mobile/app/(tabs)/portefeuille/index.tsx
// Mobile Portefeuille screen inside a native iOS Large Title Stack: renders
// unboxed TR-minimal portfolio hero (`Valeur portefeuille` + `Plus-value latente`),
// flat asset-class breakdown (`PekuloClassRow`), holding rows (`PekuloHoldingRow`),
// pull-to-refresh, and loading/error/empty states.

import {
  PekuloClassRow,
  PekuloEmptyState,
  PekuloHoldingRow,
  PekuloStat,
  Section,
} from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { LineChart } from "lucide-react-native";

import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { useAuth } from "../../../lib/auth/auth-context";
import { useMobilePortfolioData } from "../../../lib/hooks/use-mobile-queries";

export default function PortefeuilleScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobilePortfolioData();

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    totalValueFormatted: "85 900 €",
    pnlFormatted: "+12 450 €",
    pnlTone: "gain" as const,
    classes: [],
    holdings: [],
  };

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
      {showLoading ? (
        <ScreenLoadingSkeleton sections={2} />
      ) : showError ? (
        <ScreenErrorState
          title="Impossible de charger votre portefeuille"
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <View gap="$7">
          <View
            backgroundColor="$backgroundCard"
            borderRadius="$xl"
            padding="$5"
            gap="$4"
            style={{ borderCurve: "continuous" }}
          >
            <PekuloStat label="Valeur portefeuille" value={viewData.totalValueFormatted} />
            <PekuloStat
              label="Plus-value latente"
              value={viewData.pnlFormatted}
              tone={viewData.pnlTone}
            />
          </View>

          {viewData.classes.length > 0 && (
            <Section flat title="Répartition" ariaLabel="Répartition du portefeuille">
              {viewData.classes.map((cls) => (
                <PekuloClassRow
                  key={cls.label}
                  label={cls.label}
                  amountEur={cls.amountEur}
                  pct={cls.pct}
                />
              ))}
            </Section>
          )}

          <Section flat title="Lignes" ariaLabel="Lignes du portefeuille">
            {viewData.holdings.length > 0 ? (
              viewData.holdings.map((holding) => (
                <PekuloHoldingRow key={`${holding.ticker}-${holding.account}`} holding={holding} />
              ))
            ) : (
              <PekuloEmptyState
                icon={LineChart}
                title="Aucune position ouverte"
                message="Ajoutez vos ETF, actions ou crypto depuis votre espace Pekulo pour suivre vos plus-values."
              />
            )}
          </Section>
        </View>
      )}
    </ScreenShell>
  );
}
