// apps/mobile/app/(tabs)/immobilier.tsx
// Mobile Immobilier screen: renders total net equity (`Équité nette`),
// valuation, remaining debt, and per-property `PekuloPropertyCard` items
// from `useMobileRealEstateData()`.

import { PekuloPropertyCard, PekuloStat } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";
import { useMobileRealEstateData } from "../../lib/hooks/use-mobile-queries";

export default function ImmobilierScreen() {
  const { data } = useMobileRealEstateData();

  const viewData = data ?? {
    totalEquityFormatted: "70 000 €",
    totalValuationFormatted: "250 000 €",
    totalDebtFormatted: "180 000 €",
    properties: [],
  };

  return (
    <ScreenShell title="Immobilier" subtitle="Biens, crédits et équité nette">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
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

      {viewData.properties.map((property) => (
        <PekuloPropertyCard key={property.label} property={property} />
      ))}
    </ScreenShell>
  );
}
