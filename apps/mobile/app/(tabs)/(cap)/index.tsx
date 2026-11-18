// apps/mobile/app/(tabs)/(cap)/index.tsx
// Cap root screen (matches "/"). Renders cross-platform @pekulo/ui pilot
// components (PekuloHero + PekuloStat) with baseline V1.5 preview metrics
// until story 10-4 wires @pekulo/contracts oRPC data.

import { PekuloHero, PekuloStat } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Link } from "expo-router";
import { Pressable } from "react-native";

import { ScreenShell } from "../../../components/screen-shell";

function SettingsAvatarLink() {
  return (
    <Link href="/parametres" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les paramètres"
        hitSlop={8}
        testID="open-settings-btn"
      >
        <View
          width={36}
          height={36}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            A
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function CapScreen() {
  return (
    <ScreenShell
      title="Cap"
      subtitle="Trajectoire vers votre objectif patrimonial"
      headerRight={<SettingsAvatarLink />}
    >
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
            <PekuloStat label="Avancement" value="22,6 %" />
          </View>
          <View flex={1}>
            <PekuloStat label="Prochain palier" value="100 k€ · 2032" />
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}
