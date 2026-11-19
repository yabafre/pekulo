// apps/mobile/app/(tabs)/mensuel.tsx
// Mobile Mensuel screen: renders current month savings (`Épargne nette`,
// `Entrées`, `Sorties`) and monthly history rows (`PekuloMonthlyRow`) from
// `useMobileMonthlyData()`.

import { PekuloMonthlyRow, PekuloStat, Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";
import { useMobileMonthlyData } from "../../lib/hooks/use-mobile-queries";

export default function MensuelScreen() {
  const { data } = useMobileMonthlyData();

  const viewData = data ?? {
    currentNetFormatted: "+1 240 €",
    currentNetTone: "gain" as const,
    currentIncomeFormatted: "+3 400 €",
    currentSpendingFormatted: "−2 160 €",
    months: [],
  };

  return (
    <ScreenShell title="Mensuel" subtitle="Bilan et clôture du mois en cours">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
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

      {viewData.months.length > 0 && (
        <Section title="Historique" ariaLabel="Historique mensuel">
          {viewData.months.map((month) => (
            <PekuloMonthlyRow key={month.monthLabel} month={month} />
          ))}
        </Section>
      )}
    </ScreenShell>
  );
}
