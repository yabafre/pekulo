import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function TransactionsScreen() {
  return (
    <ScreenShell title="Transactions" subtitle="Flux mensuels et catégorisation IA">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Solde du mois" value="+1 050 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Les transactions synchronisées et suggestions IA seront branchées dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
