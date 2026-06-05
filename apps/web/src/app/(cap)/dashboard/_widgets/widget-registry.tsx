"use client";
// apps/web/src/app/(cap)/dashboard/_widgets/widget-registry.tsx
// Story 7-2 (D1, AC-1) — the SSOT widget set for the Cap dashboard. Each entry
// carries the FR-41-compliant DEFAULT order/visibility, its bento colSpan, and
// a lazy render fn (an element factory — never invokes hooks itself; hooks run
// inside the returned component). Adding a widget later = add a DashboardWidgetId
// + an entry here; resolveLayout backfills it into existing stored layouts.
//
// nextMilestone is folded into the hero (HeroAnchor shows the next-milestone
// line) so it ships defaultVisible:false — the FR-41 default viewport is
// hero (wealth + delta) + compass (%). It stays a real, opt-in widget.
import type { ReactNode } from "react";
import { Section } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import type { DashboardWidgetId } from "@pekulo/validators";
import { HeroAnchor } from "../_components/hero-anchor";
import { CompositionSection } from "../_components/composition-section";
import { RecentActivitySection } from "../_components/recent-activity-section";
import { MilestonesSection } from "../_components/milestones-section";
import { PlaceholderCard } from "../_components/placeholder-card";
import { CompassSection, useCapDashboardState } from "../_compass/_components/compass-section";
import { useMilestoneStatuses } from "../_hooks/use-milestone-statuses";
import { selectNextMilestone } from "../_lib/select-next-milestone";

export interface WidgetDef {
  id: DashboardWidgetId;
  label: string;
  defaultOrder: number;
  defaultVisible: boolean;
  /** Default 12-col grid width (overridable by a stored colSpan). */
  colSpan: number;
  /** Default row-track height (overridable by a stored rowSpan). */
  rowSpan: number;
  render: () => ReactNode;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Milestones need the cap state (currentWealth + compass params); a wrapper
// keeps the registry render a plain element factory.
function MilestonesWidget() {
  const cap = useCapDashboardState();
  if (!cap) {
    return (
      <Section title="Paliers" ariaLabel="Paliers (en attente du cap)">
        <Text color="$colorTertiary" fontSize="$caption">
          En attente de la configuration du cap.
        </Text>
      </Section>
    );
  }
  return (
    <MilestonesSection
      currentWealth={cap.currentWealth}
      compassObjectif={cap.compassObjectif}
      compassHorizonYears={cap.compassHorizonYears}
    />
  );
}

// Standalone next-milestone card (folded into the hero by default; available as
// an opt-in widget). Reuses the FR-41 selection helper.
function NextMilestoneWidget() {
  const cap = useCapDashboardState();
  const { data: statuses } = useMilestoneStatuses(cap?.currentWealth ?? 0, {
    enabled: cap != null,
  });
  const next = selectNextMilestone(statuses);
  return (
    <Section title="Prochain palier" ariaLabel="Prochain palier">
      {next ? (
        <Text color="$color" fontSize="$bodySm" fontWeight="600">
          +{eur0.format(next.deltaEur)} à atteindre
        </Text>
      ) : (
        <Text color="$colorTertiary" fontSize="$caption">
          Tous les paliers sont atteints.
        </Text>
      )}
    </Section>
  );
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "hero",
    label: "Patrimoine",
    defaultOrder: 0,
    defaultVisible: true,
    colSpan: 7,
    rowSpan: 2,
    render: () => <HeroAnchor variant="card" />,
  },
  {
    id: "compass",
    label: "Cap",
    defaultOrder: 1,
    defaultVisible: true,
    colSpan: 5,
    rowSpan: 2,
    render: () => <CompassSection />,
  },
  {
    id: "nextMilestone",
    label: "Prochain palier",
    defaultOrder: 2,
    defaultVisible: false,
    colSpan: 12,
    rowSpan: 1,
    render: () => <NextMilestoneWidget />,
  },
  {
    id: "trajectory",
    label: "Trajectoire",
    defaultOrder: 3,
    defaultVisible: true,
    colSpan: 7,
    rowSpan: 2,
    render: () => <PlaceholderCard variant="trajectory" ownerStory="7-1" />,
  },
  {
    id: "milestones",
    label: "Paliers",
    defaultOrder: 4,
    defaultVisible: true,
    colSpan: 5,
    rowSpan: 2,
    render: () => <MilestonesWidget />,
  },
  {
    id: "hypothesis",
    label: "Hypothèse",
    defaultOrder: 5,
    defaultVisible: true,
    colSpan: 12,
    rowSpan: 1,
    render: () => <PlaceholderCard variant="hypothesis" ownerStory="6-x" />,
  },
  {
    id: "composition",
    label: "Composition",
    defaultOrder: 6,
    defaultVisible: true,
    colSpan: 5,
    rowSpan: 1,
    render: () => <CompositionSection variant="card" />,
  },
  {
    id: "recentActivity",
    label: "Activité récente",
    defaultOrder: 7,
    defaultVisible: true,
    colSpan: 7,
    rowSpan: 1,
    render: () => <RecentActivitySection variant="card" />,
  },
];
