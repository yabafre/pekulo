"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useFormatter, useTranslations } from "next-intl";
import type { AdvisoryStatus } from "@pekulo/validators";
import { PekuloButton, PekuloEmptyState, PekuloSkeleton, Section, useToast } from "@pekulo/ui";
import { Sparkles, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
import {
  useAdvisoryLatestSession,
  useAdvisoryStatus,
  useGenerateAdvisoryAnalysis,
} from "../_hooks/use-advisory";
import { AdvisoryDisclaimer } from "./advisory-disclaimer";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";
import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";
import styles from "./advisory.module.css";

export interface AdvisoryViewProps {
  initialStatus: AdvisoryStatus;
}

function sanitizeItem(text: string): string {
  return text.replace(/^\s*(?:⚠️|[•\-*])\s*/u, "").trim();
}

// LLM output is not guaranteed unique; disambiguate duplicates without using
// the array index as the React key.
function withStableKeys<T>(items: readonly T[], keyOf: (item: T) => string) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { item, key: `${base}-${occurrence}` };
  });
}

export function AdvisoryView({ initialStatus }: AdvisoryViewProps) {
  const t = useTranslations("advisory");
  const format = useFormatter();
  const toast = useToast();
  const { data: status } = useAdvisoryStatus({ initialData: initialStatus });
  const { data: session, isLoading, isError, refetch } = useAdvisoryLatestSession();
  const generateMutation = useGenerateAdvisoryAnalysis();

  const eur0 = (amount: number) =>
    format.number(amount, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  const signed = (amount: number) => `${amount >= 0 ? "+" : ""}${eur0(amount)}`;

  const handleGenerate = () => {
    // Both the header button and the empty-state CTA land here; a double click
    // must not fire two paid LLM generations.
    if (generateMutation.isPending) return;

    generateMutation.mutate(
      { forceRefresh: true },
      {
        onError: (error) => toast.danger(t("errors.generate"), error.message),
      },
    );
  };

  // Defence in depth: the server gate already redirected non-allowlisted users,
  // but if access is revoked while the page is open, stop rendering the analysis.
  if (status && status.access !== "active") return null;

  const wealth = session?.sessionData?.snapshot?.wealth;
  const compass = session?.sessionData?.snapshot?.compass;

  return (
    <div className={`${styles.container} font_body`}>
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
          generatedAt={session.sessionData.generatedAt}
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
            <Section ariaLabel={t("sections.strengths")}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
            <Section ariaLabel={t("sections.risks")}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
          </div>
        </div>
      ) : !session ? (
        isError ? (
          <Section ariaLabel={t("errors.loadTitle")}>
            <PekuloEmptyState
              icon={AlertTriangle}
              title={t("errors.loadTitle")}
              message={t("errors.loadDescription")}
              ctaLabel={t("errors.retry")}
              onCta={() => {
                void refetch();
              }}
            />
          </Section>
        ) : (
          <Section ariaLabel={t("emptyState.title")}>
            <PekuloEmptyState
              icon={Sparkles}
              title={t("emptyState.title")}
              message={t("emptyState.description")}
              ctaLabel={generateMutation.isPending ? undefined : t("actions.generate")}
              onCta={handleGenerate}
            />
          </Section>
        )
      ) : (
        <div className={styles.container}>
          {/* Synthèse générale + Métriques financières */}
          <Section ariaLabel={t("sections.overview")} title={t("sections.overview")}>
            {wealth && (
              <div className={styles.statsRow}>
                <div className={styles.statTile}>
                  <span className={styles.statLabel}>{t("stats.totalWealth")}</span>
                  <span className={styles.statValue}>{eur0(wealth.totalEur)}</span>
                  {compass && (
                    <span className={styles.statSub}>
                      {t("stats.compassPercent", {
                        percent: format.number(compass.percent, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }),
                      })}
                    </span>
                  )}
                </div>

                {compass && (
                  <div className={styles.statTile}>
                    <span className={styles.statLabel}>{t("stats.compassTarget")}</span>
                    <span className={styles.statValue}>{eur0(compass.targetEur)}</span>
                    <span className={styles.statSub}>
                      {t("stats.compassGap", { gap: eur0(compass.gapEur) })}
                    </span>
                  </div>
                )}

                <div className={styles.statTile}>
                  <span className={styles.statLabel}>{t("stats.unrealizedPnl")}</span>
                  <span
                    className={styles.statValue}
                    style={{
                      color: wealth.unrealizedPnlEur >= 0 ? "var(--perfGain)" : "var(--perfLoss)",
                    }}
                  >
                    {signed(wealth.unrealizedPnlEur)}
                  </span>
                  <span className={styles.statSub}>{t("stats.financialPortfolio")}</span>
                </div>

                <div className={styles.statTile}>
                  <span className={styles.statLabel}>{t("stats.investable")}</span>
                  <span className={styles.statValue}>{eur0(wealth.investableEur)}</span>
                  <span className={styles.statSub}>{t("stats.cashAndInvestments")}</span>
                </div>
              </div>
            )}

            <p className={styles.overviewText}>{session.sessionData.analysis.overview}</p>
          </Section>

          {/* Diagnostic : Forces & Risques */}
          <div className={styles.grid2Col}>
            <Section ariaLabel={t("sections.strengths")} title={t("sections.strengths")}>
              <div className={styles.diagnosticList}>
                {session.sessionData.analysis.strengths.length === 0 ? (
                  <p className={styles.diagnosticItemText}>{t("errors.emptyStrengths")}</p>
                ) : (
                  withStableKeys(session.sessionData.analysis.strengths, sanitizeItem).map(
                    ({ item, key }) => (
                      <div key={key} className={styles.diagnosticItem}>
                        <CheckCircle2
                          size={16}
                          color="var(--perfGain)"
                          className={styles.diagnosticIcon}
                          aria-hidden
                        />
                        <p className={styles.diagnosticItemText}>{sanitizeItem(item)}</p>
                      </div>
                    ),
                  )
                )}
              </div>
            </Section>

            <Section ariaLabel={t("sections.risks")} title={t("sections.risks")}>
              <div className={styles.diagnosticList}>
                {session.sessionData.analysis.risks.length === 0 ? (
                  <p className={styles.diagnosticItemText}>{t("errors.emptyRisks")}</p>
                ) : (
                  withStableKeys(session.sessionData.analysis.risks, sanitizeItem).map(
                    ({ item, key }) => (
                      <div key={key} className={styles.diagnosticItem}>
                        <AlertTriangle
                          size={16}
                          color="var(--warning)"
                          className={styles.diagnosticIcon}
                          aria-hidden
                        />
                        <p className={styles.diagnosticItemText}>{sanitizeItem(item)}</p>
                      </div>
                    ),
                  )
                )}
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
              {withStableKeys(session.sessionData.analysis.recommendations, (rec) => rec.id).map(
                ({ item, key }) => (
                  <AdvisoryRecommendationCard key={key} recommendation={item} />
                ),
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
