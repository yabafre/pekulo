"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PekuloDonut, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useDashboardCompass } from "../_hooks/use-dashboard-compass";
import { useCompassCurve } from "../_hooks/use-compass-curve";
import { AddMilestoneForm } from "./add-milestone-form";
import { CompassSetupCta } from "./compass-setup-cta";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function horizonAbsoluteYearMaxFor(horizonYears: number | undefined): number {
  const currentYear = new Date().getUTCFullYear();
  if (horizonYears == null) return currentYear + 1;
  return currentYear + horizonYears - 1;
}

// CompassSection is the **DonutCard** slot in the Cap-view bento (ux-preview
// `<DonutCard>`, App.tsx:749). It renders ONLY the donut + "Restant" headline
// and the incomplete-state branches (setup CTA / inline first-milestone
// form / loading skeleton / error alert). MilestonesSection lives in a
// sibling bento cell and is composed at the page level — splitting the two
// avoids forcing the donut + milestones list into a single column on
// desktop where they occupy adjacent 5-col cells.
export function CompassSection() {
  const router = useRouter();
  const [showInlineForm, setShowInlineForm] = useState(false);
  const { setup, compass, progress } = useDashboardCompass();
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
  if (setup.isError) {
    return (
      <Section ariaLabel="Cap indisponible">
        <View padding="$4">
          <Text role="alert" color="$danger" fontSize="$caption">
            Cap indisponible. Réessaie dans un instant.
          </Text>
        </View>
      </Section>
    );
  }
  if (setup.data === "incomplete") {
    // AC-3: the CTA opens the add-milestone-form. Branching:
    //   - compass row exists → render the form inline inside the donut cell
    //     (the donut DOES NOT render in this state, per AC-3).
    //   - compass row missing (truly fresh user) → route to /parametres so
    //     they can set the compass first; the milestone year range cannot
    //     be validated without a horizon.
    if (showInlineForm && compass.data) {
      return (
        <Section ariaLabel="Ajouter ton premier palier" title="Premier palier">
          <AddMilestoneForm
            milestoneCount={0}
            horizonAbsoluteYearMax={horizonAbsoluteYearMaxFor(compass.data.horizonYears)}
            onSuccess={() => setShowInlineForm(false)}
          />
        </Section>
      );
    }
    return (
      <Section ariaLabel="Configuration du cap">
        <CompassSetupCta
          onAddMilestone={() => {
            if (compass.data) {
              setShowInlineForm(true);
            } else {
              router.push("/dashboard/parametres");
            }
          }}
        />
      </Section>
    );
  }
  if (progress.isError || compass.isError) {
    return (
      <Section ariaLabel="Cap indisponible">
        <View padding="$4">
          <Text role="alert" color="$danger" fontSize="$caption">
            Cap indisponible. Réessaie dans un instant.
          </Text>
        </View>
      </Section>
    );
  }
  const pct = progress.data ? progress.data.percent / 100 : 0;
  const remaining = progress.data?.gap ?? 0;
  const pctLabel = `${(pct * 100).toFixed(1)} %`;

  return (
    <Section ariaLabel={`Cap ${pctLabel}`}>
      <View
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="$6"
        height="100%"
        paddingVertical="$2"
      >
        <PekuloDonut pct={pct} size={208} stroke={6} centered ariaLabel={`Cap ${pctLabel}`} />
        <View alignItems="center">
          <Text color="$colorTertiary" fontSize="$caption">
            Restant
          </Text>
          <Text
            color="$color"
            fontSize="$h2"
            fontWeight="600"
            marginTop="$1"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {eur0.format(remaining)}
          </Text>
        </View>
      </View>
    </Section>
  );
}

// Helper for page.tsx — derive the milestones-section props from the same
// hooks CompassSection consumes (single source of truth for the dashboard's
// React-Query state). Returns null when setup is loading / error / incomplete
// so the bento can hide the milestones cell in those states.
export function useCapDashboardState() {
  const { setup, compass, progress } = useDashboardCompass();
  if (setup.data !== "complete") return null;
  if (setup.isError || progress.isError || compass.isError) return null;
  const currentWealth = progress.data?.currentWealth ?? 0;
  return {
    currentWealth,
    horizonAbsoluteYearMax: horizonAbsoluteYearMaxFor(progress.data?.horizonYears),
    compassObjectif: progress.data?.objectif,
    compassHorizonYears: progress.data?.horizonYears,
  };
}
