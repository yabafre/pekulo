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
import { useRouter } from "expo-router";
import { LineChart } from "lucide-react-native";
import { Pressable } from "react-native";

import { useMutationRunner } from "../../../components/form/sheet";
import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { TabToolbar } from "../../../components/tab-stack-layout";
import { confirmDestructive, showActions } from "../../../lib/actions";
import { useAuth } from "../../../lib/auth/auth-context";
import { useHoldingMutations } from "../../../lib/hooks/use-mobile-mutations";
import { useMobilePortfolioData } from "../../../lib/hooks/use-mobile-queries";

export default function PortefeuilleScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobilePortfolioData();
  const router = useRouter();
  const { close } = useHoldingMutations();
  const { run } = useMutationRunner();

  function openHoldingActions(id: string, label: string) {
    showActions(label, [
      {
        label: "Enregistrer un achat ou une vente",
        onPress: () => router.push(`/sheets/lot?id=${id}`),
      },
      {
        label: "Clôturer la ligne",
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: `Clôturer « ${label} » ?`,
            message: "La ligne sortira de votre portefeuille actif.",
            confirmLabel: "Clôturer",
            onConfirm: () => {
              void run(() => close.mutateAsync({ id }), "Ligne clôturée");
            },
          }),
      },
    ]);
  }

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    totalValueFormatted: "85 900 €",
    pnlFormatted: "+12 450 €",
    pnlTone: "gain" as const,
    classes: [],
    holdings: [],
    holdingIds: [],
    accountOptions: [],
  };

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
      <TabToolbar addLabel="Nouvelle ligne" onAdd={() => router.push("/sheets/holding")} />
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
        <View gap="$8">
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
              viewData.holdings.map((holding, index) => {
                const id = viewData.holdingIds[index];
                return (
                  <Pressable
                    key={id ?? `${holding.ticker}-${holding.account}`}
                    testID={id ? `holding-row-${id}` : undefined}
                    accessibilityRole="button"
                    accessibilityHint="Ouvre les actions de la ligne"
                    disabled={!id}
                    onPress={() => id && openHoldingActions(id, holding.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloHoldingRow holding={holding} />
                  </Pressable>
                );
              })
            ) : (
              <PekuloEmptyState
                icon={LineChart}
                title="Aucune position ouverte"
                message="Ajoutez vos ETF, actions ou crypto pour suivre vos plus-values."
                ctaLabel="Ajouter une ligne"
                onCta={() => router.push("/sheets/holding")}
              />
            )}
          </Section>
        </View>
      )}
    </ScreenShell>
  );
}
