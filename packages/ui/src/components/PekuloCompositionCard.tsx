"use client";

// packages/ui/src/components/PekuloCompositionCard.tsx
// Desktop bento cell — section-framed list of wealth-class rows.

import { View } from "tamagui";
import type { CompositionItem } from "@pekulo/types";
import { Section } from "../primitives/Section";
import { PekuloCompositionRow } from "./PekuloCompositionRow";

export interface PekuloCompositionCardProps {
  items: Array<CompositionItem & { id: string }>;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloCompositionCard({
  items,
  className,
  title = "Composition",
  ariaLabel,
}: PekuloCompositionCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <View flexDirection="column">
        {items.map(({ id, ...row }) => (
          <PekuloCompositionRow key={id} {...row} />
        ))}
      </View>
    </Section>
  );
}
