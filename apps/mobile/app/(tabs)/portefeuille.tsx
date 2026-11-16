import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function PortefeuilleScreen() {
  return (
    <ScreenShell title="Portefeuille" subtitle="ETF, actions et crypto">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Plus-value latente" value="+12 450 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Les lignes, lots et cotations multi-devises seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
