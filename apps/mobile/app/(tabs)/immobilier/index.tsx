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

export default function ImmobilierScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileRealEstateData();
  const router = useRouter();
  const { deleteProperty } = useRealEstateMutations();
  const { run } = useMutationRunner();

  function openPropertyActions(id: string, label: string) {
    showActions(label, [
      {
        label: "Mettre à jour la valeur",
        onPress: () => router.push(`/sheets/valuation?id=${id}`),
      },
      {
        label: "Historique des valeurs",
        onPress: () => router.push(`/sheets/valuations?id=${id}`),
      },
      { label: "Crédit immobilier", onPress: () => router.push(`/sheets/mortgage?id=${id}`) },
      { label: "Loyer", onPress: () => router.push(`/sheets/rental?id=${id}`) },
      {
        label: "Supprimer le bien",
        destructive: true,
        onPress: () =>
          confirmDestructive({
            title: `Supprimer « ${label} » ?`,
            message: "Le bien, son crédit, son loyer et son historique seront supprimés.",
            confirmLabel: "Supprimer",
            onConfirm: () => {
              void run(() => deleteProperty.mutateAsync({ id }), "Bien supprimé");
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
      <TabToolbar addLabel="Nouveau bien" onAdd={() => router.push("/sheets/property")} />
      {showLoading ? (
        <ScreenLoadingSkeleton sections={1} />
      ) : showError ? (
        <ScreenErrorState
          title="Impossible de charger vos biens"
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
            <PekuloStat label="Équité nette" value={viewData.totalEquityFormatted} />
            <View flexDirection="row" gap="$4">
              <View flex={1}>
                <PekuloStat label="Valorisation" value={viewData.totalValuationFormatted} />
              </View>
              <View flex={1}>
                <PekuloStat label="Dette restante" value={viewData.totalDebtFormatted} />
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
                    accessibilityHint="Ouvre les actions du bien"
                    disabled={!id}
                    onPress={() => id && openPropertyActions(id, property.label)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <PekuloPropertyCard property={property} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <PekuloEmptyState
              icon={Building2}
              title="Aucun bien immobilier"
              message="Renseignez vos biens et crédits immobiliers pour intégrer votre équité nette au cap."
              ctaLabel="Ajouter un bien"
              onCta={() => router.push("/sheets/property")}
            />
          )}
        </View>
      )}
    </ScreenShell>
  );
}
