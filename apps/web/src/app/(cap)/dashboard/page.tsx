// apps/web/src/app/(cap)/dashboard/page.tsx — Cap view (FR-1 → FR-8 UI surfaces).
// Client Component: every child consumes React Query hooks.
//
// Layout mirrors ux-preview `<CapView>` (App.tsx:331-356) verbatim. The
// responsive switch lives in `_components/bento.module.css` behind a
// single `@media (min-width: 1024px)` rule (matches Tailwind `lg:`). The
// shell-level padding (sidebar clearance + main inset) lives in the same
// CSS module and is applied by `CapShell` so this page only owns the
// bento itself.
//
// Story 1-4 owns the DonutCard + MilestonesCard cells. The remaining
// cells are scope-faithful `<PlaceholderCard>` frames that render a
// Section with "Bientôt — branché par story X-Y" — each placeholder gets
// swapped for the real card when its owning story lands (HeroCard / 7-1,
// TrajectoryCard / 7-1, CompositionCard / 5-x, RecentActivityCard / 5-x,
// HypothesisCard / 6-x).
"use client";

import { CompassSection, useCapDashboardState } from "./_components/compass-section";
import { MilestonesSection } from "./_components/milestones-section";
import { PlaceholderCard } from "./_components/placeholder-card";
import styles from "./_components/bento.module.css";

export default function DashboardPage() {
  const cap = useCapDashboardState();

  return (
    <div className={styles.bento}>
      <div className={styles.heroCard}>
        <PlaceholderCard title="Patrimoine total" ownerStory="7-1 (Cap dashboard composition)" />
      </div>
      <div className={styles.donutCard}>
        <CompassSection />
      </div>
      <div className={styles.trajectoryCard}>
        <PlaceholderCard title="Trajectoire" ownerStory="7-1 (chart UI)" />
      </div>
      <div className={styles.milestonesCard}>
        {cap ? (
          <MilestonesSection
            currentWealth={cap.currentWealth}
            horizonAbsoluteYearMax={cap.horizonAbsoluteYearMax}
            compassObjectif={cap.compassObjectif}
            compassHorizonYears={cap.compassHorizonYears}
          />
        ) : (
          <PlaceholderCard
            title="Paliers"
            ownerStory="story 1-4 (en attente du cap)"
            ariaLabel="Paliers — en attente que le cap soit configuré"
          />
        )}
      </div>
      <div className={styles.compositionCard}>
        <PlaceholderCard title="Composition" ownerStory="story 5-x" />
      </div>
      <div className={styles.recentActivityCard}>
        <PlaceholderCard title="Activité récente" ownerStory="story 5-x" />
      </div>
      <div className={styles.hypothesisCard}>
        <PlaceholderCard title="Hypothèse de projection" ownerStory="story 6-x (hypothèse)" />
      </div>
    </div>
  );
}
