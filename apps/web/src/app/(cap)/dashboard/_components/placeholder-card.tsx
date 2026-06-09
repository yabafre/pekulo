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

type PlaceholderVariant = "trajectory" | "hypothesis";

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

function HypothesisPlaceholder() {
  return (
    <View flexDirection="column" gap="$3" paddingVertical="$1">
      <SkeletonLine width="80%" height={16} />
      <SkeletonLine width="55%" height={12} />
    </View>
  );
}

const VARIANT_TITLES: Record<PlaceholderVariant, string> = {
  trajectory: "Trajectoire",
  hypothesis: "Hypothèse de projection",
};

export function PlaceholderCard({ variant, ownerStory, className }: PlaceholderCardProps) {
  const title = VARIANT_TITLES[variant];
  const body = variant === "trajectory" ? <TrajectoryPlaceholder /> : <HypothesisPlaceholder />;
  // The outer wrapper is `flex: 1; justify-content: space-between` so the
  // body sits at the TOP of the available cell height and the footnote
  // pins to the BOTTOM. Without this, lighter placeholders stack at the
  // top of an oversized cell and the rest of the cell reads as empty —
  // exactly the visual hole the user flagged on Pass 6.
  return (
    <Section className={className} title={title} ariaLabel={`${title} (bientôt — ${ownerStory})`}>
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
