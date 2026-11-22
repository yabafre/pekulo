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
import { useI18n } from "../../../lib/i18n";
import { holdingKindLabel } from "../../../lib/options";

export default function PortefeuilleScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobilePortfolioData();
  const router = useRouter();
  const { close } = useHoldingMutations();
  const { run } = useMutationRunner();
  const { t } = useI18n();

  function openHoldingActions(id: string, label: string) {
    showActions(label, [
      {
        label: t("portfolio.actions.recordLot"),
        onPress: () => router.push(`/sheets/lot?id=${id}`),
      },
      {
        label: t("portfolio.actions.close"),
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: t("portfolio.actions.closeTitle", { label }),
            message: t("portfolio.actions.closeMessage"),
            confirmLabel: t("portfolio.actions.closeConfirm"),
            onConfirm: () => {
              void run(() => close.mutateAsync({ id }), t("portfolio.actions.closed"));
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
      <TabToolbar
        addLabel={t("portfolio.screen.addHolding")}
        onAdd={() => router.push("/sheets/holding")}
      />
      {showLoading ? (
        <ScreenLoadingSkeleton sections={2} />
      ) : showError ? (
        <ScreenErrorState
          title={t("portfolio.screen.loadError")}
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
            <PekuloStat label={t("portfolio.screen.value")} value={viewData.totalValueFormatted} />
            <PekuloStat
              label={t("portfolio.screen.pnl")}
              value={viewData.pnlFormatted}
              tone={viewData.pnlTone}
            />
          </View>

          {viewData.classes.length > 0 && (
            <Section
              flat
              title={t("portfolio.screen.allocation")}
              ariaLabel={t("portfolio.screen.allocationAria")}
            >
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

          <Section
            flat
            title={t("portfolio.screen.holdings")}
            ariaLabel={t("portfolio.screen.holdingsAria")}
          >
            {viewData.holdings.length > 0 ? (
              viewData.holdings.map((holding, index) => {
                const id = viewData.holdingIds[index];
                return (
                  <Pressable
                    key={id ?? `${holding.ticker}-${holding.account}`}
                    testID={id ? `holding-row-${id}` : undefined}
                    accessibilityRole="button"
                    accessibilityHint={t("portfolio.screen.holdingHint")}
                    disabled={!id}
                    onPress={() => id && openHoldingActions(id, holding.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <PekuloHoldingRow
                      holding={holding}
                      kindLabel={holdingKindLabel(t, holding.kind)}
                    />
                  </Pressable>
                );
              })
            ) : (
              <PekuloEmptyState
                icon={LineChart}
                title={t("portfolio.screen.emptyTitle")}
                message={t("portfolio.screen.emptyMessage")}
                ctaLabel={t("portfolio.screen.emptyCta")}
                onCta={() => router.push("/sheets/holding")}
              />
            )}
          </Section>
        </View>
      )}
    </ScreenShell>
  );
}
