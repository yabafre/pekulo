"use client";

// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useTranslations } from "next-intl";
import { Cpu, ShieldCheck } from "lucide-react";
import styles from "./advisory.module.css";

export interface AdvisoryProviderBadgeProps {
  provider: string;
  model: string;
  generatedAt?: string;
}

export function AdvisoryProviderBadge({
  provider,
  model,
  generatedAt,
}: AdvisoryProviderBadgeProps) {
  const t = useTranslations("advisory.providerBadge");

  const formattedDate = generatedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(generatedAt))
    : null;

  return (
    <div role="note" aria-label={t("posture")} className={styles.providerMeta}>
      <span className={styles.providerPill}>
        <Cpu size={13} color="var(--colorSecondary)" aria-hidden />
        <span>
          {provider} / {model}
        </span>
      </span>

      <span>·</span>

      <span className={styles.providerPill}>
        <ShieldCheck size={13} color="var(--gain)" aria-hidden />
        <span>{t("posture")}</span>
      </span>

      {formattedDate && (
        <>
          <span>·</span>
          <span>{t("generatedAt", { date: formattedDate })}</span>
        </>
      )}
    </div>
  );
}
