"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import styles from "./advisory.module.css";

export function AdvisoryDisclaimer() {
  const t = useTranslations("advisory");

  return (
    <aside role="region" aria-label={t("disclaimer.title")} className={styles.disclaimer}>
      <ShieldAlert size={16} className={styles.disclaimerIcon} aria-hidden />
      <div className={styles.disclaimerContent}>
        <div className={styles.disclaimerHeader}>
          <h2 className={styles.disclaimerTitle}>{t("disclaimer.title")}</h2>
          <span className={styles.disclaimerBadge}>{t("disclaimer.badge")}</span>
        </div>
        <p className={styles.disclaimerBody}>{t("disclaimer.body")}</p>
      </div>
    </aside>
  );
}
