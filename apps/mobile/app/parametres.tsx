import { PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

import { ScreenShell } from "../components/screen-shell";

export default function ParametresScreen() {
  return (
    <ScreenShell title="Paramètres" subtitle="Apparence, compte et préférences">
      <View backgroundColor="$backgroundCard" borderRadius="$xl" padding="$5" gap="$4">
        <PekuloStat label="Design System" value="Pekulo Tamagui v2" />
        <Text color="$colorSecondary" fontSize="$bodySm">
          La session Supabase, le thème persisté et les préférences seront branchés dans la story
          10-4.
        </Text>
      </View>
    </ScreenShell>
  );
}
