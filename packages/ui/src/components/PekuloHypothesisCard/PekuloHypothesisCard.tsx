"use client";

// packages/ui/src/components/PekuloHypothesisCard.tsx
// Desktop bento cell — section-framed hypothesis verdict.

import { Section } from "../../primitives/Section";
import {
  PekuloHypothesisVerdict,
  type PekuloHypothesisVerdictProps,
} from "../PekuloHypothesisVerdict";

export interface PekuloHypothesisCardProps extends PekuloHypothesisVerdictProps {
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PekuloHypothesisCard({
  className,
  title = "Hypothèse",
  ariaLabel,
  ...verdictProps
}: PekuloHypothesisCardProps) {
  return (
    <Section className={className} title={title} ariaLabel={ariaLabel ?? title}>
      <PekuloHypothesisVerdict {...verdictProps} />
    </Section>
  );
}
