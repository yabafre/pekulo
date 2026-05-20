"use client";

// packages/ui/src/components/PekuloDonutCard.tsx
// Desktop bento cell — section-framed donut.

import { Section } from "../../primitives/Section";
import { PekuloDonut, type PekuloDonutProps } from "../PekuloDonut";

export interface PekuloDonutCardProps extends PekuloDonutProps {
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloDonutCard({
  className,
  title,
  ariaLabel,
  ...donutProps
}: PekuloDonutCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title ?? "Compass"}>
      <PekuloDonut {...donutProps} />
    </Section>
  );
}
