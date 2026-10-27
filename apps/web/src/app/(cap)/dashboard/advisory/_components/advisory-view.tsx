"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useTranslations } from "next-intl";
import type { AdvisoryStatus } from "@pekulo/validators";
import { PekuloButton, PekuloEmptyState, PekuloSkeleton, Section } from "@pekulo/ui";
import { Sparkles, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
import { useAdvisoryLatestSession, useGenerateAdvisoryAnalysis } from "../_hooks/use-advisory";
import { AdvisoryDisclaimer } from "./advisory-disclaimer";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";
import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";
import styles from "./advisory.module.css";

export interface AdvisoryViewProps {
  initialStatus: AdvisoryStatus;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function signed(amount: number): string {
  return `${amount >= 0 ? "+" : ""}${eur0.format(amount)}`;
}

function sanitizeItem(text: string): string {
  return text.replace(/^\s*(?:⚠️|[•\-*])\s*/u, "").trim();
}

export function AdvisoryView({ initialStatus: _ }: AdvisoryViewProps) {
  const t = useTranslations("advisory");
  const { data: session, isLoading } = useAdvisoryLatestSession();
  const generateMutation = useGenerateAdvisoryAnalysis();

  const handleGenerate = () => {
    generateMutation.mutate({ forceRefresh: true });
  };

  const wealth = session?.sessionData?.snapshot?.wealth;
  const compass = session?.sessionData?.snapshot?.compass;

  return (
    <div className={styles.container}>
      {/* Top Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>{t("title")}</h1>
          <p className={styles.pageSubtitle}>{t("subtitle")}</p>
        </div>

        <PekuloButton
          variant="default"
          size="default"
          onClick={handleGenerate}
          loading={generateMutation.isPending}
          loadingLabel={t("actions.generating")}
          className="font_body"
        >
          <Sparkles size={15} color="var(--colorOnAccent)" aria-hidden />
          <span>{session ? t("actions.refresh") : t("actions.generate")}</span>
        </PekuloButton>
      </header>

      {/* Regulatory Notice Banner */}
      <AdvisoryDisclaimer />

      {/* Provider Posture Meta Line */}
      {session && (
        <AdvisoryProviderBadge
          provider={session.provider}
          model={session.model}
          generatedAt={session.createdAt}
        />
      )}

      {isLoading ? (
        <div className={styles.container} role="status" aria-live="polite">
          <Section ariaLabel={t("actions.generating")}>
            <PekuloSkeleton width="40%" height={12} />
            <div style={{ height: 12 }} />
            <PekuloSkeleton block height={80} />
          </Section>
          <div className={styles.grid2Col}>
            <Section ariaLabel={t("sections.strengths")} className={styles.cardStretch}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
            <Section ariaLabel={t("sections.risks")} className={styles.cardStretch}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
          </div>
        </div>
      ) : !session ? (
        <Section ariaLabel={t("emptyState.title")}>
          <PekuloEmptyState
            icon={Sparkles}
            title={t("emptyState.title")}
            message={t("emptyState.description")}
            ctaLabel={t("actions.generate")}
            onCta={handleGenerate}
          />
        </Section>
      ) : (
        <div className={styles.container}>
          {/* Synthèse générale + Métriques financières */}
          <Section ariaLabel={t("sections.overview")} title={t("sections.overview")}>
            {wealth && (
              <div className={styles.statsRow}>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Patrimoine total</span>
                  <span className={styles.statValue}>{eur0.format(wealth.totalEur)}</span>
                  {compass && (
                    <span className={styles.statSub}>{compass.percent.toFixed(1)} % du Cap</span>
                  )}
                </div>

                {compass && (
                  <div className={styles.statTile}>
                    <span className={styles.statLabel}>Objectif Cap</span>
                    <span className={styles.statValue}>{eur0.format(compass.targetEur)}</span>
                    <span className={styles.statSub}>Écart : {eur0.format(compass.gapEur)}</span>
                  </div>
                )}

                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Plus-values latentes</span>
                  <span
                    className={styles.statValue}
                    style={{
                      color: wealth.unrealizedPnlEur >= 0 ? "var(--gain)" : "var(--loss)",
                    }}
                  >
                    {signed(wealth.unrealizedPnlEur)}
                  </span>
                  <span className={styles.statSub}>Portefeuille financier</span>
                </div>

                <div className={styles.statTile}>
                  <span className={styles.statLabel}>Investissable</span>
                  <span className={styles.statValue}>{eur0.format(wealth.investableEur)}</span>
                  <span className={styles.statSub}>Cash + placements</span>
                </div>
              </div>
            )}

            <p className={styles.overviewText}>{session.sessionData.analysis.overview}</p>
          </Section>

          {/* Diagnostic : Forces & Risques */}
          <div className={styles.grid2Col}>
            <Section
              ariaLabel={t("sections.strengths")}
              title={t("sections.strengths")}
              className={styles.cardStretch}
            >
              <div className={styles.diagnosticList}>
                {session.sessionData.analysis.strengths.map((str) => (
                  <div key={str} className={styles.diagnosticItem}>
                    <CheckCircle2
                      size={16}
                      color="var(--gain)"
                      className={styles.diagnosticIcon}
                      aria-hidden
                    />
                    <p className={styles.diagnosticItemText}>{sanitizeItem(str)}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              ariaLabel={t("sections.risks")}
              title={t("sections.risks")}
              className={styles.cardStretch}
            >
              <div className={styles.diagnosticList}>
                {session.sessionData.analysis.risks.map((risk) => (
                  <div key={risk} className={styles.diagnosticItem}>
                    <AlertTriangle
                      size={16}
                      color="var(--warning)"
                      className={styles.diagnosticIcon}
                      aria-hidden
                    />
                    <p className={styles.diagnosticItemText}>{sanitizeItem(risk)}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Stratégie d'allocation */}
          <Section
            ariaLabel={t("sections.allocationAdvice")}
            title={t("sections.allocationAdvice")}
          >
            <div className={styles.allocationBox}>
              <PieChart size={18} className={styles.allocationIcon} aria-hidden />
              <p className={styles.allocationText}>
                {session.sessionData.analysis.allocationAdvice}
              </p>
            </div>
          </Section>

          {/* Recommandations d'arbitrage */}
          <Section
            ariaLabel={t("sections.recommendations")}
            title={`${t("sections.recommendations")} (${session.sessionData.analysis.recommendations.length})`}
          >
            <div className={styles.recommendationsList}>
              {session.sessionData.analysis.recommendations.map((rec) => (
                <AdvisoryRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  provider={session.provider}
                  model={session.model}
                />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
