// apps/web/src/app/(cap)/dashboard/page.tsx — Cap view (FR-1 → FR-8 UI surfaces).
// Client Component: every child consumes React Query hooks.
//
// Layout mirrors ux-preview `<CapView>` (App.tsx:331-356) verbatim. The
// responsive switch lives in `_components/bento.module.css` behind a
// single `@media (min-width: 1020px)` rule (matches Tailwind `lg:`, and
// aligned with `PekuloNavRail`'s `$max-md` threshold). Chrome (sidebar +
// topbar) lives in `layout.tsx` → `CapShell`.
//
// Story 1-4 owns the DonutCard + MilestonesCard cells. The remaining
// cells render scope-faithful `<PlaceholderCard>` frames (skeleton-style
// for HeroCard / Trajectory / Composition / Activity / Hypothesis).
//
// The "+ Ajouter un palier" affordance opens a `PekuloDialog` mounted at
// this level via `AddMilestoneDialogProvider`. Both the MilestonesSection
// header pill and the CompassSection setup-CTA trigger the same modal —
// the V0 inline-form pattern broke the bento row track.
"use client";

import { AddMilestoneDialogProvider } from "./_components/add-milestone-dialog";
import { CompassSection, useCapDashboardState } from "./_components/compass-section";
import { MilestonesSection } from "./_components/milestones-section";
import { PlaceholderCard } from "./_components/placeholder-card";
import styles from "./_components/bento.module.css";

export default function DashboardPage() {
  const cap = useCapDashboardState();

  // Both CompassSection's CTA and MilestonesSection's header pill open
  // the same dialog. Year-max derives from `compass.horizonYears`; fall
  // back to current-year + 1 until the compass query resolves so the
  // form's validator stays callable.
  const horizonMax = cap?.horizonAbsoluteYearMax ?? new Date().getUTCFullYear() + 1;

  return (
    <AddMilestoneDialogProvider horizonAbsoluteYearMax={horizonMax}>
      <div className={styles.bento}>
        <div className={styles.heroCard}>
          <PlaceholderCard variant="hero" ownerStory="7-1" />
        </div>
        <div className={styles.donutCard}>
          <CompassSection />
        </div>
        <div className={styles.trajectoryCard}>
          <PlaceholderCard variant="trajectory" ownerStory="7-1" />
        </div>
        <div className={styles.milestonesCard}>
          {cap ? (
            <MilestonesSection
              currentWealth={cap.currentWealth}
              compassObjectif={cap.compassObjectif}
              compassHorizonYears={cap.compassHorizonYears}
            />
          ) : (
            <PlaceholderCard variant="hypothesis" ownerStory="story 1-4 (en attente du cap)" />
          )}
        </div>
        <div className={styles.compositionCard}>
          <PlaceholderCard variant="composition" ownerStory="5-x" />
        </div>
        <div className={styles.recentActivityCard}>
          <PlaceholderCard variant="activity" ownerStory="5-x" />
        </div>
        <div className={styles.hypothesisCard}>
          <PlaceholderCard variant="hypothesis" ownerStory="6-x" />
        </div>
      </div>
    </AddMilestoneDialogProvider>
  );
}
