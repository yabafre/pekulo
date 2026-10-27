"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useTranslations } from "next-intl";
import type { AdvisoryRecommendation } from "@pekulo/validators";
import { ArrowRight, Tag } from "lucide-react";
import styles from "./advisory.module.css";

export interface AdvisoryRecommendationCardProps {
  recommendation: AdvisoryRecommendation;
  provider: string;
  model: string;
}

export function AdvisoryRecommendationCard({
  recommendation,
  provider: _,
  model: __,
}: AdvisoryRecommendationCardProps) {
  const t = useTranslations("advisory.recommendations");

  const badgeClass =
    recommendation.action === "buy" || recommendation.action === "allocate"
      ? styles.badgeBuy
      : recommendation.action === "sell"
        ? styles.badgeSell
        : recommendation.action === "trim" || recommendation.action === "reduce"
          ? styles.badgeTrim
          : recommendation.action === "rebalance"
            ? styles.badgeRebalance
            : styles.badgeHold;

  const isHighPriority = recommendation.priority === "high";

  return (
    <div className={styles.recommendationCard}>
      <div className={styles.cardHeaderRow}>
        <div className={styles.cardTitleCluster}>
          <span className={`${styles.actionBadge} ${badgeClass}`}>
            {t(`action.${recommendation.action}`)}
          </span>
          <h3 className={styles.cardTitle}>{recommendation.title}</h3>
        </div>

        <span className={`${styles.priorityBadge} ${isHighPriority ? styles.priorityHigh : ""}`}>
          {t(`priority.${recommendation.priority}`)}
        </span>
      </div>

      <div className={styles.targetRow}>
        <Tag size={13} color="var(--colorTertiary)" aria-hidden />
        <span>{t("target", { target: recommendation.target })}</span>
      </div>

      <p className={styles.rationaleText}>{recommendation.rationale}</p>

      {recommendation.instrumentRecommendation && (
        <div className={styles.instrumentBox}>
          <div className={styles.instrumentHeader}>
            <ArrowRight size={13} color="var(--colorSecondary)" aria-hidden />
            <span className={styles.instrumentSymbol}>
              {recommendation.instrumentRecommendation.symbol}
            </span>
            {recommendation.instrumentRecommendation.isin && (
              <span className={styles.instrumentIsin}>
                ({recommendation.instrumentRecommendation.isin})
              </span>
            )}
          </div>
          <p className={styles.instrumentRationale}>
            {recommendation.instrumentRecommendation.rationale}
          </p>
        </div>
      )}
    </div>
  );
}
