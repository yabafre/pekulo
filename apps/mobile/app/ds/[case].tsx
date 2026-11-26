// apps/mobile/app/ds/[case].tsx
// Story 10-5 AC-4 — renders one @pekulo/ui parity case for screenshot goldens.
// Deep link: pekulo://ds/<caseId>?theme=pekulo-dark|pekulo-light
// Redirects to "/" when the gallery is disabled or the case id is unknown.
// The `ds-case-<id>` container is the Maestro cropOn target, so the status
// bar clock never enters a golden.
// Story 10-6: a `ds-next` button (outside that container) steps to the next
// golden case in place, so a Maestro shard opens one deep link and then taps —
// every iOS `simctl openurl` raises the "Open in Pekulo?" prompt and is slow.
import { Text, Theme, View } from "@pekulo/ui/client";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView } from "react-native";

import { isDsGalleryEnabled, resolveGalleryTheme } from "../../lib/ds-gallery";

export default function DsGalleryCaseScreen() {
  const params = useLocalSearchParams<{
    case?: string | string[];
    theme?: string | string[];
  }>();
  const router = useRouter();
  if (!isDsGalleryEnabled()) return <Redirect href="/" />;
  const caseId = typeof params.case === "string" ? params.case : undefined;
  const { PARITY_CASES } = require("@pekulo/ui/parity") as typeof import("@pekulo/ui/parity");
  const parityCase = caseId ? PARITY_CASES.find((c) => c.id === caseId) : undefined;
  if (!parityCase) return <Redirect href="/" />;
  const theme = resolveGalleryTheme(params.theme);
  const goldenIds = PARITY_CASES.filter((c) => c.golden).map((c) => c.id);
  const nextId = goldenIds[goldenIds.indexOf(parityCase.id) + 1];

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
        {nextId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cas suivant : ${nextId}`}
            testID="ds-next"
            onPress={() => router.setParams({ case: nextId })}
            style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Text color="$colorTertiary" fontSize="$xs">
              {nextId}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Theme>
  );
}
