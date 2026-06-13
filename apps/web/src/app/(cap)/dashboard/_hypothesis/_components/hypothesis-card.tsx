"use client";

import {
  PekuloProjectionChart,
  PekuloHypothesisVerdict,
  PekuloSkeleton,
  Section,
} from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { useHypothesisProjection } from "../_hooks/use-hypothesis-projection";
import { useHypothesisGap } from "../_hooks/use-hypothesis-gap";
import { buildChartModel } from "../_lib/build-chart-model";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Story 7-4 (FR-57/58/59) — the Cap-view Hypothèse card. Composes the 7-3
// projected curve (useHypothesisProjection) with the FR-59 server gap
// (useHypothesisGap): projected vs compass-required curve, the €/month gap, and
// the verdict. currentWealth is the LIVE investable wealth threaded from
// useCapDashboardState (the widget wrapper passes it). The card holds ZERO
// financial arithmetic — every number is server-derived; buildChartModel only
// maps offsets → calendar years (AC-9).
export function HypothesisCard({ currentWealth }: { currentWealth: number }) {
  const projection = useHypothesisProjection(currentWealth);
  const gap = useHypothesisGap(currentWealth);

  if (projection.isLoading || gap.isLoading) {
    return (
      <Section title="Hypothèse" ariaLabel="Hypothèse (chargement)">
        <View role="status" aria-live="polite" $lg={{ flex: 1, minHeight: 0 }}>
          <Text
            color="$colorTertiary"
            fontSize="$caption"
            position="absolute"
            width={1}
            height={1}
            overflow="hidden"
          >
            Chargement de la projection…
          </Text>
          <PekuloSkeleton block height={160} />
        </View>
      </Section>
    );
  }
  // No compass (gap null) or a read error → invite setup rather than draw a
  // misleading chart (AC-5). The widget wrapper already short-circuits the
  // no-cap case; this is the defensive in-card branch.
  if (projection.isError || gap.isError || !projection.data || !gap.data) {
    return (
      <Section title="Hypothèse" ariaLabel="Hypothèse indisponible">
        <Text role="alert" color="$colorTertiary" fontSize="$caption">
          Configure ton cap pour voir ta projection.
        </Text>
      </Section>
    );
  }

  const proj = projection.data;
  const g = gap.data;
  const baseYear = new Date().getFullYear();
  const model = buildChartModel(proj, g, baseYear, currentWealth);
  const ratePct = (proj.annualRate * 100).toFixed(1);

  return (
    <Section
      title="Hypothèse"
      ariaLabel="Hypothèse de projection"
      action={
        <Text color="$colorTertiary" fontSize="$caption">
          {eur0.format(proj.monthlyContribution)} / mois · {ratePct} % / an
        </Text>
      }
    >
      <View flexDirection="column" gap="$4" $lg={{ flex: 1, minHeight: 0 }}>
        <PekuloProjectionChart
          years={model.years}
          actual={model.actual}
          required={model.required}
          nowMarker={model.nowMarker}
          capMarker={model.capMarker}
        />
        <PekuloHypothesisVerdict
          projectedEur={g.projectedFinalEur}
          requiredEur={g.requiredFinalEur}
          targetYear={baseYear + g.horizonYears}
          gapEurPerMonth={g.reachesCap ? undefined : g.gapEurPerMonth}
        />
      </View>
    </Section>
  );
}
