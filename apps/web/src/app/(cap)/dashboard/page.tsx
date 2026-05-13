// apps/web/src/app/(cap)/dashboard/page.tsx — Cap view (FR-1 → FR-8 UI surfaces).
// Client Component: every child consumes React Query hooks.
//
// Layout mirrors ux-preview `<CapView>` (App.tsx:331-356) — mobile is a
// single-column stack with `gap-10` between sections; desktop is a 12-col
// bento grid with `auto-rows-[minmax(112px,auto)]` rows. The grid declarations
// live in `_components/bento.module.css` because Tamagui's responsive props
// can't drive `display: grid` switches.
//
// Story 1-4 owns the DonutCard + MilestonesCard cells. The remaining cells
// (HeroCard / TrajectoryCard / CompositionCard / RecentActivityCard /
// HypothesisCard) render scope-faithful `<PlaceholderCard>` frames — the
// Section reads correct, the body announces which story owns the wiring,
// and each placeholder gets swapped for the real card when that story lands.
//
// Chrome (sidebar nav + topbar) lives in `layout.tsx` → `CapShell`.
"use client";

import { View } from "@pekulo/ui/client";
import { CompassSection, useCapDashboardState } from "./_components/compass-section";
import { MilestonesSection } from "./_components/milestones-section";
import { PlaceholderCard } from "./_components/placeholder-card";
import styles from "./_components/bento.module.css";

export default function DashboardPage() {
  const cap = useCapDashboardState();

  return (
    <View
      flex={1}
      paddingHorizontal="$5"
      paddingTop="$4"
      paddingBottom={112}
      $lg={{
        paddingHorizontal: "$2",
        paddingTop: "$4",
        paddingBottom: "$8",
      }}
    >
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
    </View>
  );
}
