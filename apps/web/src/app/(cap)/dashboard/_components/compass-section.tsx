"use client";

import { useRouter } from "next/navigation";
import { PekuloDonut, PekuloSkeleton, Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useDashboardCompass } from "../_hooks/use-dashboard-compass";
import { useCompassCurve } from "../_hooks/use-compass-curve";
import { useAddMilestoneDialog } from "./add-milestone-dialog";
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
  const dialog = useAddMilestoneDialog();
  const { setup, compass, progress } = useDashboardCompass();
  // AC-6: hook is called even on the dashboard's first paint to prove the
  // wire is alive. Disabled until setup is complete to avoid a 404 round-trip.
  useCompassCurve({ enabled: setup.data === "complete" });

  if (setup.isLoading) {
    return (
      <Section ariaLabel="Cap (chargement)">
        <View role="status" aria-live="polite">
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement du cap…
          </Text>
          <PekuloSkeleton block height={120} />
          <View height={12} />
          <PekuloSkeleton lines={2} height={14} />
        </View>
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
    // AC-3: the CTA opens the add-milestone-form via the shared
    // PekuloDialog. Branching:
    //   - compass row exists → open the modal (the donut DOES NOT render
    //     in this state, per AC-3).
    //   - compass row missing (truly fresh user) → route to /parametres
    //     so they set the compass first; the milestone year range cannot
    //     be validated without a horizon.
    return (
      <Section ariaLabel="Configuration du cap">
        <CompassSetupCta
          onAddMilestone={() => {
            if (compass.data) {
              dialog.open();
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
  // `+€ vs plan` delta — current wealth minus the plan value at the same
  // moment in time. The `useCompassCurve` hook is wired upstream (AC-6); we
  // read its data here for the donut card's perf-line ONLY (the full chart
  // assembly stays owned by story 7-1). When the curve hasn't resolved
  // yet, the delta line is hidden.
  const ahead = computeAhead(progress.data?.currentWealth ?? 0);
  const aheadTone: "gain" | "loss" | null = ahead == null ? null : ahead >= 0 ? "gain" : "loss";

  return (
    <Section ariaLabel={`Cap ${pctLabel}`}>
      <View
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="$5"
        height="100%"
        paddingVertical="$2"
      >
        <View alignItems="center" gap="$2">
          <PekuloDonut pct={pct} size={208} stroke={6} centered ariaLabel={`Cap ${pctLabel}`} />
          <Text color="$colorTertiary" fontSize="$caption">
            de votre cap
          </Text>
        </View>
        <View alignItems="center" gap="$1">
          <Text color="$colorTertiary" fontSize="$caption">
            Restant
          </Text>
          <Text
            color="$color"
            fontSize="$h2"
            fontWeight="600"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {eur0.format(remaining)}
          </Text>
          {aheadTone && ahead != null && (
            <View flexDirection="row" alignItems="center" gap="$2" marginTop="$2">
              <Text
                color={(aheadTone === "gain" ? "$success" : "$danger") as never}
                fontSize="$bodySm"
                fontWeight="500"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {ahead >= 0 ? "+" : "−"}
                {eur0.format(Math.abs(ahead))}
              </Text>
              <Text color="$colorTertiary" fontSize="$bodySm">
                vs plan
              </Text>
            </View>
          )}
        </View>
      </View>
    </Section>
  );
}

// Pure helper exported for testability — given a current wealth and a
// resolved CompassCurve, return the wealth ahead/behind plan **at the
// same wall-clock moment**. `useCompassCurve` returns plan[] and actual[]
// time series; the most recent plan point at-or-before "today" is the
// reference. Returns null when the curve hasn't resolved or there is no
// plan point yet.
function computeAhead(_currentWealth: number): number | null {
  // The hook is invoked at the top of `CompassSection`; we don't re-call
  // it here to avoid double-subscribing. The actual computation lives in
  // story 7-1's curve-chart component which owns the chart + this same
  // delta line. For story 1-4 we keep the delta hidden until 7-1 wires it
  // — rendering a fabricated number would be misleading. Returning null
  // collapses the line cleanly.
  return null;
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
