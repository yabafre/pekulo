// apps/mobile/app/(tabs)/immobilier/index.tsx
// Mobile Immobilier screen inside a native iOS Large Title Stack: renders total
// net equity (`Équité nette`), valuation, remaining debt, per-property
// `PekuloPropertyCard` items, pull-to-refresh, and loading/error/empty states.

import { PekuloEmptyState, PekuloPropertyCard, PekuloStat } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { Building2 } from "lucide-react-native";

import { ScreenShell } from "../../../components/screen-shell";
import { ScreenErrorState, ScreenLoadingSkeleton } from "../../../components/screen-states";
import { useAuth } from "../../../lib/auth/auth-context";
import { useMobileRealEstateData } from "../../../lib/hooks/use-mobile-queries";

export default function ImmobilierScreen() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, isRefetching, refetch } = useMobileRealEstateData();

  const showLoading = isAuthenticated && isLoading && !data;
  const showError = isAuthenticated && isError && !data;

  const viewData = data ?? {
    totalEquityFormatted: "70 000 €",
    totalValuationFormatted: "250 000 €",
    totalDebtFormatted: "180 000 €",
    properties: [],
  };

  return (
    <ScreenShell refreshing={isRefetching} onRefresh={refetch}>
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
              {viewData.properties.map((property) => (
                <PekuloPropertyCard key={property.label} property={property} />
              ))}
            </View>
          ) : (
            <PekuloEmptyState
              icon={Building2}
              title="Aucun bien immobilier"
              message="Renseignez vos biens et crédits immobiliers pour intégrer votre équité nette au cap."
            />
          )}
        </View>
      )}
    </ScreenShell>
  );
}
