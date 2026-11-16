import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../../components/screen-shell";

export default function MensuelScreen() {
  return (
    <ScreenShell title="Mensuel" subtitle="Bilan et clôture du mois en cours">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Épargne nette" value="+1 240 €" tone="gain" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          Le suivi mensuel et la clôture seront branchés dans la story 10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
