"use client";

// Cap view — `/dashboard` default. Dual rendering per ux-preview
// App.tsx:331-356: flat single-column mobile (lg:hidden) + 12-col bento
// desktop (lg:grid). Mobile cells drop the card chrome (Section flat=true
// or inline flat placeholders); desktop keeps the bento card cells.

import { View, Text } from "@pekulo/ui/client";
import { PekuloDonut, PekuloSkeleton } from "@pekulo/ui";
import { AddMilestoneDialogProvider } from "./add-milestone-dialog";
import { CompassSection, useCapDashboardState } from "./compass-section";
import { MilestonesSection } from "./milestones-section";
import { PlaceholderCard } from "./placeholder-card";
import { useDashboardCompass } from "../_hooks/use-dashboard-compass";
import styles from "./bento.module.css";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Thin wrapper kept for the FlatListPlaceholder rows (multiple fixed-width
// PekuloSkeleton calls per row). Could inline-call PekuloSkeleton directly
// at each callsite but the local alias keeps the JSX readable.
function SkeletonLine({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  return <PekuloSkeleton block width={width} height={height} />;
}

function FlatListPlaceholder({ rows, ownerStory }: { rows: number; ownerStory: string }) {
  const keys = ["a", "b", "c", "d", "e"].slice(0, rows);
  return (
    <View flexDirection="column" gap="$3">
      {keys.map((k) => (
        <View
          key={`row-${k}`}
          flexDirection="row"
          alignItems="center"
          gap="$3"
          paddingVertical="$2"
        >
          <View width={28} height={28} borderRadius="$full" backgroundColor="$backgroundMuted" />
          <View flex={1} flexDirection="column" gap="$1">
            <SkeletonLine width="60%" height={12} />
            <SkeletonLine width="30%" height={10} />
          </View>
          <SkeletonLine width={60} height={12} />
        </View>
      ))}
      <View flexDirection="row" justifyContent="flex-end" marginTop="$1">
        <Text color="$colorMuted" fontSize="$xs">
          Bientôt · {ownerStory}
        </Text>
      </View>
    </View>
  );
}

function MobileFlatCapView() {
  const cap = useCapDashboardState();
  const { progress } = useDashboardCompass();
  const data = progress.data;
  const currentYear = new Date().getUTCFullYear();
  const targetYear = data ? currentYear + data.horizonYears - 1 : null;
  const yearsLeft = targetYear ? targetYear - currentYear : null;
  // Linear plan / year — gap divided over remaining years.
  const requiredYearly = data && yearsLeft && yearsLeft > 0 ? data.gap / yearsLeft : null;
  const pct = data ? data.percent / 100 : 0;

  return (
    <View flexDirection="column" gap={40} width="100%">
      {/* Hero — Aujourd'hui + current wealth. Delta vs plan needs story 7-1
          curve data, hidden until then per the desktop CompassSection
          precedent ("delta hidden when curve unresolved"). */}
      <View render="section" aria-label="Patrimoine total">
        <Text color="$colorTertiary" fontSize="$caption">
          Aujourd'hui
        </Text>
        {data ? (
          <Text color="$color" fontSize="$h1" fontWeight="600" letterSpacing={-0.5} marginTop="$2">
            {eur0.format(data.currentWealth)}
          </Text>
        ) : (
          <View marginTop="$2">
            <SkeletonLine width={200} height={36} />
          </View>
        )}
        {data ? (
          <Text color="$colorTertiary" fontSize="$bodySm" marginTop="$2">
            Cap {eur0.format(data.objectif)} · {targetYear}
          </Text>
        ) : (
          <View marginTop="$2">
            <SkeletonLine width={160} height={14} />
          </View>
        )}
      </View>

      {/* MiniKpis — Cap pct + Horizon + Plan / an (3-col flat). Mirrors
          ux-preview MiniKpis (App.tsx:419-443). Real data from
          `useDashboardCompass`. */}
      <View render="section" aria-label="Indicateurs">
        <View flexDirection="row" gap="$3">
          {/* Cap tile — donut + percent + remaining */}
          <View flex={1} flexDirection="column" gap="$2" paddingVertical="$2">
            <View flexDirection="row" alignItems="center" justifyContent="space-between">
              <Text color="$colorTertiary" fontSize="$caption">
                Cap
              </Text>
              {data && <PekuloDonut pct={pct} size={22} stroke={2.5} />}
            </View>
            {data ? (
              <>
                <Text color="$color" fontSize="$h3" fontWeight="600">
                  {(pct * 100).toFixed(1)} %
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  {eurCompact.format(data.gap)} € restants
                </Text>
              </>
            ) : (
              <>
                <SkeletonLine width="80%" height={18} />
                <SkeletonLine width="60%" height={10} />
              </>
            )}
          </View>

          {/* Horizon tile — target year + years left */}
          <View flex={1} flexDirection="column" gap="$2" paddingVertical="$2">
            <Text color="$colorTertiary" fontSize="$caption">
              Horizon
            </Text>
            {data && targetYear && yearsLeft != null ? (
              <>
                <Text color="$color" fontSize="$h3" fontWeight="600">
                  {targetYear}
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  {yearsLeft} ans
                </Text>
              </>
            ) : (
              <>
                <SkeletonLine width="80%" height={18} />
                <SkeletonLine width="60%" height={10} />
              </>
            )}
          </View>

          {/* Plan / an tile — linear required yearly */}
          <View flex={1} flexDirection="column" gap="$2" paddingVertical="$2">
            <Text color="$colorTertiary" fontSize="$caption">
              Plan / an
            </Text>
            {requiredYearly != null ? (
              <>
                <Text color="$color" fontSize="$h3" fontWeight="600">
                  {eurCompact.format(requiredYearly)} €
                </Text>
                <Text color="$colorTertiary" fontSize="$caption">
                  linéaire
                </Text>
              </>
            ) : (
              <>
                <SkeletonLine width="80%" height={18} />
                <SkeletonLine width="60%" height={10} />
              </>
            )}
          </View>
        </View>
      </View>

      {/* Trajectoire (story 7-1) */}
      <View render="section" aria-labelledby="traj-h" flexDirection="column">
        <Text
          id="traj-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
        >
          Trajectoire
        </Text>
        <View height={140} backgroundColor="$backgroundMuted" borderRadius="$md" />
        <View flexDirection="row" justifyContent="flex-end" marginTop="$2">
          <Text color="$colorMuted" fontSize="$xs">
            Bientôt · 7-1
          </Text>
        </View>
      </View>

      {/* Paliers — real, flat */}
      {cap ? (
        <MilestonesSection
          currentWealth={cap.currentWealth}
          compassObjectif={cap.compassObjectif}
          compassHorizonYears={cap.compassHorizonYears}
          flat
        />
      ) : (
        <View render="section" aria-label="Paliers (en attente du cap)" flexDirection="column">
          <Text color="$color" fontSize="$h3" fontWeight="600" marginBottom="$3">
            Paliers
          </Text>
          <Text color="$colorTertiary" fontSize="$caption">
            En attente de la configuration du cap.
          </Text>
        </View>
      )}

      {/* Hypothèse (story 6-x) */}
      <View render="section" aria-labelledby="hyp-h" flexDirection="column">
        <Text
          id="hyp-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
        >
          Hypothèse
        </Text>
        <SkeletonLine width="80%" height={14} />
        <View marginTop="$2">
          <SkeletonLine width="55%" height={12} />
        </View>
        <View flexDirection="row" justifyContent="flex-end" marginTop="$2">
          <Text color="$colorMuted" fontSize="$xs">
            Bientôt · 6-x
          </Text>
        </View>
      </View>

      {/* Composition (story 5-x) */}
      <View render="section" aria-labelledby="comp-h" flexDirection="column">
        <Text
          id="comp-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
        >
          Composition
        </Text>
        <FlatListPlaceholder rows={3} ownerStory="5-x" />
      </View>

      {/* Activité récente (story 5-x) */}
      <View render="section" aria-labelledby="act-h" flexDirection="column">
        <Text
          id="act-h"
          render="h2"
          color="$color"
          fontSize="$h3"
          fontWeight="600"
          marginBottom="$3"
        >
          Activité récente
        </Text>
        <FlatListPlaceholder rows={5} ownerStory="5-x" />
      </View>
    </View>
  );
}

export function CapView() {
  const cap = useCapDashboardState();
  const horizonMax = cap?.horizonAbsoluteYearMax ?? new Date().getUTCFullYear() + 1;

  return (
    <AddMilestoneDialogProvider horizonAbsoluteYearMax={horizonMax}>
      {/* Mobile + tablet — flat single-column stack (ux-preview L334-343) */}
      <View $lg={{ display: "none" }}>
        <MobileFlatCapView />
      </View>

      {/* Desktop — 12-col bento (ux-preview L346-355) */}
      <View display="none" $lg={{ display: "block" }}>
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
      </View>
    </AddMilestoneDialogProvider>
  );
}
