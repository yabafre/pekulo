// apps/mobile/app/(tabs)/immobilier/index.tsx
// Mobile Immobilier screen inside a native iOS Large Title Stack: renders total
// net equity (`Équité nette`), valuation, remaining debt, per-property
// `PekuloPropertyCard` items, pull-to-refresh, and loading/error/empty states.

import { PekuloEmptyState, PekuloPropertyCard, PekuloStat } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { useRouter } from "expo-router";
import { Building2 } from "lucide-react-native";
import { Pressable } from "react-native";

import { useMutationRunner } from "../../../components/form/sheet";
import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { TabToolbar } from "../../../components/tab-stack-layout";
import { confirmDestructive, showActions } from "../../../lib/actions";
import { useAuth } from "../../../lib/auth/auth-context";
import { useRealEstateMutations } from "../../../lib/hooks/use-mobile-mutations";
import { useMobileRealEstateData } from "../../../lib/hooks/use-mobile-queries";
import { useI18n } from "../../../lib/i18n";

export default function ImmobilierScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileRealEstateData();
  const router = useRouter();
  const { deleteProperty } = useRealEstateMutations();
  const { run } = useMutationRunner();
  const { t } = useI18n();
  const cardLabels = {
    valuation: t("realestate.card.valuation"),
    equity: t("realestate.card.equity"),
    debt: t("realestate.card.debt"),
    monthlyPayment: (years: number) => t("realestate.card.monthlyPayment", { years }),
    repaid: (pct: number) => t("realestate.card.repaid", { pct }),
  };

  function openPropertyActions(id: string, label: string) {
    showActions(label, [
      {
        label: t("realestate.actions.updateValuation"),
        onPress: () => router.push(`/sheets/valuation?id=${id}`),
      },
      {
        label: t("realestate.actions.history"),
        onPress: () => router.push(`/sheets/valuations?id=${id}`),
      },
      {
        label: t("realestate.actions.mortgage"),
        onPress: () => router.push(`/sheets/mortgage?id=${id}`),
      },
      {
        label: t("realestate.actions.rental"),
        onPress: () => router.push(`/sheets/rental?id=${id}`),
      },
      {
        label: t("realestate.actions.delete"),
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: t("realestate.actions.deleteTitle", { label }),
            message: t("realestate.actions.deleteMessage"),
            confirmLabel: t("common.actions.delete"),
            onConfirm: () => {
              void run(() => deleteProperty.mutateAsync({ id }), t("realestate.actions.deleted"));
            },
          }),
      },
    ]);
  }

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    totalEquityFormatted: "70 000 €",
    totalValuationFormatted: "250 000 €",
    totalDebtFormatted: "180 000 €",
    properties: [],
    propertyIds: [],
  };

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
      <TabToolbar
        addLabel={t("realestate.screen.addProperty")}
        onAdd={() => router.push("/sheets/property")}
      />
      {showLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : showError ? (
        <ScreenErrorState
          title={t("realestate.screen.loadError")}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <View gap="$6">
          <View
            backgroundColor="$backgroundCard"
            borderRadius="$xl"
            padding="$5"
            gap="$4"
            style={{ borderCurve: "continuous" }}
          >
            <PekuloStat
              label={t("realestate.screen.equity")}
              value={viewData.totalEquityFormatted}
            />
            <View flexDirection="row" gap="$4">
              <View flex={1}>
                <PekuloStat
                  label={t("realestate.screen.valuation")}
                  value={viewData.totalValuationFormatted}
                />
              </View>
              <View flex={1}>
                <PekuloStat
                  label={t("realestate.screen.debt")}
                  value={viewData.totalDebtFormatted}
                />
              </View>
            </View>
          </View>

          {viewData.properties.length > 0 ? (
            <View gap="$4">
              {viewData.properties.map((property, index) => {
                const id = viewData.propertyIds[index];
                return (
                  <Pressable
                    key={id ?? property.label}
                    testID={id ? `property-card-${id}` : undefined}
                    accessibilityRole="button"
                    accessibilityHint={t("realestate.screen.propertyHint")}
                    disabled={!id}
                    onPress={() => id && openPropertyActions(id, property.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <PekuloPropertyCard property={property} labels={cardLabels} hideEmptyMortgage />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <PekuloEmptyState
              icon={Building2}
              title={t("realestate.screen.emptyTitle")}
              message={t("realestate.screen.emptyMessage")}
              ctaLabel={t("realestate.screen.emptyCta")}
              onCta={() => router.push("/sheets/property")}
            />
          )}
        </View>
      )}
    </ScreenShell>
  );
}
