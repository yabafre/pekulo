import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function ImmobilierScreen() {
  return (
    <ScreenShell title="Immobilier" subtitle="Biens, crédits et équité nette">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Équité nette" value="70 000 €" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Le suivi immobilier et le cash-flow locatif seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
