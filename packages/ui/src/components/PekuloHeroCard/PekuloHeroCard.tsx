"use client";

// packages/ui/src/components/PekuloHeroCard.tsx
// Desktop bento cell wrapping PekuloHero in <Section>. Mobile renders the
// raw PekuloHero (variant="mobile") without a card.

import { Section } from "../../primitives/Section";
import { PekuloHero, type PekuloHeroProps } from "../PekuloHero";

export interface PekuloHeroCardProps extends Omit<PekuloHeroProps, "variant"> {
  /** Class-name escape hatch for grid placement. */
  className?: string;
  /** Section accessible label. */
  ariaLabel?: string;
}

export function PekuloHeroCard({ className, ariaLabel, ...heroProps }: PekuloHeroCardProps) {
  return (
    <Section className={className} ariaLabel={ariaLabel ?? "Patrimoine"}>
      <PekuloHero variant="card" {...heroProps} />
    </Section>
  );
}
