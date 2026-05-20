"use client";

// packages/ui/src/components/PekuloRecentActivityCard.tsx
// Desktop bento cell — section-framed list of confirmed activity rows.

import { View } from "tamagui";
import type { Activity } from "@pekulo/types";
import { Section } from "../../primitives/Section";
import { PekuloActivityRow } from "../PekuloActivityRow";

export interface PekuloRecentActivityCardProps {
  activities: Activity[];
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloRecentActivityCard({
  activities,
  className,
  title = "Activité récente",
  ariaLabel,
}: PekuloRecentActivityCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <View flexDirection="column">
        {activities.map((tx, i) => (
          // eslint-disable-next-line react/no-array-index-key -- activities lack stable ids; order is the caller's contract
          <PekuloActivityRow key={`${tx.label}-${tx.amountEur}-${i}`} tx={tx} />
        ))}
      </View>
    </Section>
  );
}
