"use client";

// packages/ui/src/components/PekuloTrajectoryCard.tsx
// Desktop bento cell — section-framed trajectory chart.

import { Section } from "../primitives/Section";
import { PekuloTrajectoryChart, type PekuloTrajectoryChartProps } from "./PekuloTrajectoryChart";

export interface PekuloTrajectoryCardProps extends Omit<PekuloTrajectoryChartProps, "inCard"> {
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloTrajectoryCard({
  className,
  title = "Trajectoire",
  ariaLabel,
  ...chartProps
}: PekuloTrajectoryCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <PekuloTrajectoryChart inCard {...chartProps} />
    </Section>
  );
}
