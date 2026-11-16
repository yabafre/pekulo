// apps/mobile/app/(tabs)/(cap)/index.tsx
// Cap root screen (matches "/"). Renders cross-platform @pekulo/ui pilot
// components (PekuloHero + PekuloStat) with baseline V1.5 preview metrics
// until story 10-4 wires @pekulo/contracts oRPC data.

import { PekuloHero, PekuloStat } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";

import { ScreenShell } from "../../../components/screen-shell";

export default function CapScreen() {
  return (
    <ScreenShell title="Cap" subtitle="Trajectoire vers votre objectif patrimonial">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$5">
        <PekuloHero
          variant="card"
          totalEur={180400}
          aheadEur={2781}
          targetCapital={800000}
          targetYear={2055}
          requiredYearlyEur={20653}
        />
        <View flexDirection="row" gap="$4">
          <View flex={1}>
            <PekuloStat label="Avancement" value="22,6 %" tone="gain" />
          </View>
          <View flex={1}>
            <PekuloStat label="Prochain palier" value="100 k€ · 2032" />
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}
