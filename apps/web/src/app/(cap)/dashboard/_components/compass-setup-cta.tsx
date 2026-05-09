"use client";

import { Compass } from "lucide-react";
import { PekuloEmptyState } from "@pekulo/ui";

export interface CompassSetupCtaProps {
  onAddMilestone: () => void;
}

export function CompassSetupCta({ onAddMilestone }: CompassSetupCtaProps) {
  return (
    <PekuloEmptyState
      icon={Compass}
      title="Définis ton premier palier"
      message="Pour voir ton cap, ajoute au moins un palier (capital cible + année). Tant qu'aucun palier n'existe, le cap reste un voeu."
      ctaLabel="Ajouter un palier"
      onCta={onAddMilestone}
    />
  );
}
