// apps/web/src/app/(cap)/dashboard/page.tsx — Cap view (FR-1 → FR-8 UI surfaces).
// Client Component: every child is a client island (CompassSection consumes
// React Query hooks). The auth gate lives in the layout (Server Component).
//
// Spacing mirrors ux-preview's `<main>` + `<CapView>` for the mobile-first
// path (App.tsx:160 + 335). Story 1-4 owns only the donut + milestones
// surfaces; the Hero / Trajectory / Hypothesis / Composition / Activity
// sections from the full `CapView` are owned by 7-1 / later stories and
// will be inserted as siblings of `<CompassSection>` when they land.
"use client";

import { View } from "@pekulo/ui/client";
import { CompassSection } from "./_components/compass-section";

export default function DashboardPage() {
  return (
    <View
      render="main"
      flex={1}
      paddingHorizontal="$5"
      paddingTop="$6"
      paddingBottom={112}
      $lg={{
        paddingHorizontal: "$2",
        paddingTop: "$4",
        paddingBottom: "$8",
      }}
    >
      <View
        flexDirection="column"
        gap="$10"
        width="100%"
        $lg={{ maxWidth: 1200, marginHorizontal: "auto" }}
      >
        <CompassSection />
      </View>
    </View>
  );
}
