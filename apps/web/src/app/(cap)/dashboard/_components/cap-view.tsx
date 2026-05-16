"use client";

// Cap view — `/dashboard` default. Extracted from page.tsx in story 2-3
// so the page can switch between Cap and Patrimoine via `?tab`.

import { AddMilestoneDialogProvider } from "./add-milestone-dialog";
import { CompassSection, useCapDashboardState } from "./compass-section";
import { MilestonesSection } from "./milestones-section";
import { PlaceholderCard } from "./placeholder-card";
import styles from "./bento.module.css";

export function CapView() {
  const cap = useCapDashboardState();
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
