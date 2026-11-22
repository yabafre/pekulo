// apps/mobile/app/ds/[case].tsx
// Story 10-5 AC-4 — renders one @pekulo/ui parity case for screenshot goldens.
// Deep link: pekulo://ds/<caseId>?theme=pekulo-dark|pekulo-light
// Redirects to "/" when the gallery is disabled or the case id is unknown.
// The `ds-case-<id>` container is the Maestro cropOn target, so the status
// bar clock never enters a golden.
import { View } from "@pekulo/ui/client";
import { PARITY_CASES } from "@pekulo/ui/parity";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { Theme } from "tamagui";

import { isDsGalleryEnabled, resolveGalleryTheme } from "../../lib/ds-gallery";

export default function DsGalleryCaseScreen() {
  const params = useLocalSearchParams<{ case?: string; theme?: string }>();
  if (!isDsGalleryEnabled()) return <Redirect href="/" />;
  const parityCase = PARITY_CASES.find((c) => c.id === params.case);
  if (!parityCase) return <Redirect href="/" />;
  const theme = resolveGalleryTheme(params.theme);

  return (
    <Theme name={theme}>
      <View flex={1} backgroundColor="$background">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16 }}
        >
          <View
            testID={`ds-case-${parityCase.id}`}
            collapsable={false}
            padding="$4"
            backgroundColor="$background"
          >
            {parityCase.render()}
          </View>
        </ScrollView>
      </View>
    </Theme>
  );
}
