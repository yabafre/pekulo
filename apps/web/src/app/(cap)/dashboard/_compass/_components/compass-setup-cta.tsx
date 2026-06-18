"use client";

import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { PekuloEmptyState } from "@pekulo/ui";

export interface CompassSetupCtaProps {
  onAddMilestone: () => void;
}

export function CompassSetupCta({ onAddMilestone }: CompassSetupCtaProps) {
  const t = useTranslations("dashboard");
  return (
    <PekuloEmptyState
      icon={Compass}
      title={t("compassSetupTitle")}
      message={t("compassSetupMessage")}
      ctaLabel={t("addMilestone")}
      onCta={onAddMilestone}
    />
  );
}
