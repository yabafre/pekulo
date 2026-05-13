"use client";

// apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx
//
// Scope-faithful placeholders for the Cap-view bento cells whose data
// lives in stories that haven't shipped yet. Each variant renders the
// structural shell of its owning surface (heading anchor + a couple of
// skeleton lines or a faint chart trace) so the visual layout reads
// finished rather than as five identical "Bientôt" rectangles.
//
// Each placeholder gets swapped for its real card when the owning story
// lands (HeroCard / 7-1, TrajectoryCard / 7-1, CompositionCard / 5-x,
// RecentActivityCard / 5-x, HypothesisCard / 6-x).

import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

export type PlaceholderVariant = "hero" | "trajectory" | "composition" | "activity" | "hypothesis";

export interface PlaceholderCardProps {
  variant: PlaceholderVariant;
  ownerStory: string;
  className?: string;
}

// Skeleton primitive — a flat block that hints at content shape without
// pretending to be real data. Width accepts a number (px) or a CSS-percentage
// string; the latter goes through `style` because Tamagui's `width` prop
// type doesn't expose `"NN%"` literals.
function SkeletonLine({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  if (typeof width === "string") {
    return <View style={{ width, height }} backgroundColor="$backgroundMuted" borderRadius="$sm" />;
  }
  return (
    <View width={width} height={height} backgroundColor="$backgroundMuted" borderRadius="$sm" />
  );
}

function HeroPlaceholder() {
  return (
    <View flexDirection="column" gap="$3" paddingTop="$1">
      <Text color="$colorTertiary" fontSize="$caption">
        Patrimoine total
      </Text>
      <SkeletonLine width={220} height={36} />
      <SkeletonLine width={180} height={14} />
      <View flexDirection="row" gap="$8" marginTop="$5" flexWrap="wrap">
        <View flexDirection="column" gap="$1">
          <Text color="$colorTertiary" fontSize="$caption">
            Cap
          </Text>
          <SkeletonLine width={120} height={20} />
        </View>
        <View flexDirection="column" gap="$1">
          <Text color="$colorTertiary" fontSize="$caption">
            Plan / an
          </Text>
          <SkeletonLine width={120} height={20} />
        </View>
      </View>
    </View>
  );
}

function TrajectoryPlaceholder() {
  // Faint baseline + dashed line to hint at the chart shape, with
  // legend labels matching ux-preview ("Réel" / "Plan").
  return (
    <View flexDirection="column" gap="$4" flex={1} minHeight={180}>
      <View flex={1} justifyContent="center" alignItems="center">
        <svg
          width="100%"
          height="120"
          viewBox="0 0 320 120"
          preserveAspectRatio="none"
          aria-hidden={true}
        >
          <title>Trajectoire — placeholder</title>
          {/* Dashed plan line */}
          <line
            x1="0"
            y1="100"
            x2="320"
            y2="20"
            stroke="var(--colorMuted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          {/* Solid actual placeholder */}
          <line
            x1="0"
            y1="95"
            x2="320"
            y2="35"
            stroke="var(--colorMuted)"
            strokeWidth="1.5"
            opacity="0.4"
          />
        </svg>
      </View>
      <View flexDirection="row" gap="$4">
        <View flexDirection="row" alignItems="center" gap="$2">
          <View width={16} height={1.5} backgroundColor="$colorMuted" />
          <Text color="$colorTertiary" fontSize="$caption">
            Réel
          </Text>
        </View>
        <View flexDirection="row" alignItems="center" gap="$2">
          <View width={16} height={1.5} backgroundColor="$colorMuted" opacity={0.6} />
          <Text color="$colorTertiary" fontSize="$caption">
            Plan
          </Text>
        </View>
      </View>
    </View>
  );
}

function ListPlaceholder({ rows }: { rows: number }) {
  // Static placeholder rows — the key is intentionally derived from a
  // stable label sequence rather than the array index so the lint rule
  // `no-array-index-key` is satisfied. The list never reorders.
  const stableKeys = ["skeleton-row-a", "skeleton-row-b", "skeleton-row-c", "skeleton-row-d"];
  return (
    <View flexDirection="column" gap="$3">
      {stableKeys.slice(0, rows).map((key) => (
        <View key={key} flexDirection="row" alignItems="center" gap="$3" paddingVertical="$2">
          <View width={28} height={28} borderRadius="$full" backgroundColor="$backgroundMuted" />
          <View flex={1} flexDirection="column" gap="$1">
            <SkeletonLine width="60%" height={12} />
            <SkeletonLine width="30%" height={10} />
          </View>
          <SkeletonLine width={60} height={12} />
        </View>
      ))}
    </View>
  );
}

function HypothesisPlaceholder() {
  return (
    <View flexDirection="column" gap="$3" paddingVertical="$1">
      <SkeletonLine width="80%" height={16} />
      <SkeletonLine width="55%" height={12} />
    </View>
  );
}

const VARIANT_TITLES: Record<PlaceholderVariant, string> = {
  hero: "Patrimoine",
  trajectory: "Trajectoire",
  composition: "Composition",
  activity: "Activité récente",
  hypothesis: "Hypothèse de projection",
};

export function PlaceholderCard({ variant, ownerStory, className }: PlaceholderCardProps) {
  const title = VARIANT_TITLES[variant];
  const body =
    variant === "hero" ? (
      <HeroPlaceholder />
    ) : variant === "trajectory" ? (
      <TrajectoryPlaceholder />
    ) : variant === "composition" ? (
      <ListPlaceholder rows={3} />
    ) : variant === "activity" ? (
      <ListPlaceholder rows={4} />
    ) : (
      <HypothesisPlaceholder />
    );
  // The outer wrapper is `flex: 1; justify-content: space-between` so the
  // body sits at the TOP of the available cell height and the footnote
  // pins to the BOTTOM. Without this, lighter placeholders stack at the
  // top of an oversized cell and the rest of the cell reads as empty —
  // exactly the visual hole the user flagged on Pass 6.
  return (
    <Section
      className={className}
      title={variant === "hero" ? undefined : title}
      ariaLabel={`${title} (bientôt — ${ownerStory})`}
    >
      <View flex={1} flexDirection="column" justifyContent="space-between" minHeight={0}>
        <View flexDirection="column" flex={1}>
          {body}
        </View>
        <View flexDirection="row" justifyContent="flex-end" marginTop="$4">
          <Text color="$colorMuted" fontSize="$xs">
            Bientôt · {ownerStory}
          </Text>
        </View>
      </View>
    </Section>
  );
}
