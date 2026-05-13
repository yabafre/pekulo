"use client";

// apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx
//
// Scope-faithful placeholder used for the Cap-view bento cells whose
// runtime data lives in stories that haven't shipped yet (HeroCard / FR-41,
// TrajectoryCard / FR-7 chart UI, CompositionCard / FR-43,
// RecentActivityCard / FR-42, HypothesisCard / FR-57..59). The Section frame
// matches ux-preview verbatim so the visual layout reads correct; the body
// announces which story owns the wiring so the reader (and aria-review)
// understands the deferral.
//
// Once the owning story lands, the cell gets replaced by the real card —
// the bento page imports e.g. `<HeroCard />` from `@pekulo/ui` instead of
// `<PlaceholderCard slot="hero" />`.

import { Section } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";

export interface PlaceholderCardProps {
  title: string;
  ownerStory: string;
  ariaLabel?: string;
  className?: string;
}

export function PlaceholderCard({ title, ownerStory, ariaLabel, className }: PlaceholderCardProps) {
  return (
    <Section
      className={className}
      title={title}
      ariaLabel={ariaLabel ?? `${title} (bientôt — ${ownerStory})`}
    >
      <View
        flex={1}
        minHeight={120}
        alignItems="center"
        justifyContent="center"
        paddingVertical="$6"
      >
        <Text color="$colorTertiary" fontSize="$caption" textAlign="center">
          Bientôt — branché par {ownerStory}
        </Text>
      </View>
    </Section>
  );
}
