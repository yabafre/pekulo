"use client";

import { Section, PekuloDonutCard } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { useDashboardCompass } from "../_hooks/use-dashboard-compass";
import { useCompassCurve } from "../_hooks/use-compass-curve";
import { CompassSetupCta } from "./compass-setup-cta";
import { MilestonesSection } from "./milestones-section";

export function CompassSection() {
  const { setup, progress } = useDashboardCompass();
  // AC-6: hook is called even on the dashboard's first paint to prove the
  // wire is alive. Disabled until setup is complete to avoid a 404 round-trip.
  useCompassCurve({ enabled: setup.data === "complete" });

  if (setup.isLoading) {
    return (
      <Section ariaLabel="Cap (chargement)">
        <View padding="$6" />
      </Section>
    );
  }
  if (setup.data === "incomplete") {
    return (
      <Section ariaLabel="Configuration du cap">
        <CompassSetupCta
          onAddMilestone={() => {
            window.location.assign("/dashboard/parametres");
          }}
        />
      </Section>
    );
  }
  const pct = progress.data ? progress.data.percent / 100 : 0;
  const horizonAbsoluteYearMax = progress.data
    ? new Date().getUTCFullYear() + progress.data.horizonYears - 1
    : new Date().getUTCFullYear() + 1;
  const currentWealth = progress.data?.currentWealth ?? 0;

  return (
    <View flexDirection="column" gap="$5" padding="$4">
      <PekuloDonutCard
        pct={pct}
        size={208}
        stroke={12}
        centered
        title={`Cap ${(pct * 100).toFixed(1)} %`}
        ariaLabel={`Cap ${(pct * 100).toFixed(1)} %`}
      />
      <MilestonesSection
        currentWealth={currentWealth}
        horizonAbsoluteYearMax={horizonAbsoluteYearMax}
      />
    </View>
  );
}
