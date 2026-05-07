"use client";

// packages/ui/src/components/PekuloMilestonesCard.tsx
// Desktop bento cell — section-framed list of milestones.

import { View } from "tamagui";
import type { Milestone } from "@pekulo/types";
import { Section } from "../primitives/Section";
import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

export interface PekuloMilestonesCardProps {
  milestones: Milestone[];
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloMilestonesCard({
  milestones,
  className,
  title = "Paliers",
  ariaLabel,
}: PekuloMilestonesCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <View flexDirection="column">
        {milestones.map((m) => (
          <PekuloMilestoneRow key={`${m.label}-${m.targetYear}`} milestone={m} />
        ))}
      </View>
    </Section>
  );
}
