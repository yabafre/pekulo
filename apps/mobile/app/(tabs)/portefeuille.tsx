// apps/mobile/app/(tabs)/portefeuille.tsx
// Mobile Portefeuille screen: renders total value, unrealised PnL
// (`Plus-value latente`), asset-class breakdown (`PekuloClassRow`), and
// holding lines (`PekuloHoldingRow`) from `useMobilePortfolioData()`.

import { PekuloClassRow, PekuloHoldingRow, PekuloStat, Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";
import { useMobilePortfolioData } from "../../lib/hooks/use-mobile-queries";

export default function PortefeuilleScreen() {
  const { data } = useMobilePortfolioData();

  const viewData = data ?? {
    totalValueFormatted: "85 900 €",
    pnlFormatted: "+12 450 €",
    pnlTone: "gain" as const,
    classes: [],
    holdings: [],
  };

  return (
    <ScreenShell title="Portefeuille" subtitle="ETF, actions et crypto">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Valeur portefeuille" value={viewData.totalValueFormatted} />
        <PekuloStat
          label="Plus-value latente"
          value={viewData.pnlFormatted}
          tone={viewData.pnlTone}
        />
      </View>

      {viewData.classes.length > 0 && (
        <Section title="Répartition" ariaLabel="Répartition du portefeuille">
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

      {viewData.holdings.length > 0 && (
        <Section title="Lignes" ariaLabel="Lignes du portefeuille">
          {viewData.holdings.map((holding) => (
            <PekuloHoldingRow key={`${holding.ticker}-${holding.account}`} holding={holding} />
          ))}
        </Section>
      )}
    </ScreenShell>
  );
}
