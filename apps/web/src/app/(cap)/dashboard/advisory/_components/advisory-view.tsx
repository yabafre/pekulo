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
import { Text, View } from "@pekulo/ui/client";
import { Sparkles, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
import { useAdvisoryLatestSession, useGenerateAdvisoryAnalysis } from "../_hooks/use-advisory";
import { AdvisoryDisclaimer } from "./advisory-disclaimer";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";
import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";
import styles from "./advisory.module.css";

export interface AdvisoryViewProps {
  initialStatus: AdvisoryStatus;
}

export function AdvisoryView({ initialStatus: _ }: AdvisoryViewProps) {
  const t = useTranslations("advisory");
  const { data: session, isLoading } = useAdvisoryLatestSession();
  const generateMutation = useGenerateAdvisoryAnalysis();

  const handleGenerate = () => {
    generateMutation.mutate({ forceRefresh: true });
  };

  return (
    <View flexDirection="column" gap="$6" width="100%">
      {/* Top Header Bar */}
      <View
        flexDirection="row"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap="$4"
      >
        <View flexDirection="column" gap="$1" flex={1} minWidth={260}>
          <Text
            color="$color"
            fontSize="$h1"
            fontWeight="600"
            letterSpacing={-0.5}
            $lg={{ fontSize: "$hero" }}
          >
            {t("title")}
          </Text>
          <Text color="$colorSecondary" fontSize="$bodySm">
            {t("subtitle")}
          </Text>
        </View>

        <PekuloButton
          variant="default"
          size="default"
          onClick={handleGenerate}
          loading={generateMutation.isPending}
          loadingLabel={t("actions.generating")}
          className="font_body"
        >
          <View flexDirection="row" alignItems="center" gap="$2">
            <Sparkles size={16} color="var(--colorOnAccent)" aria-hidden />
            <Text color="$colorOnAccent" fontSize="$bodySm" fontWeight="600">
              {session ? t("actions.refresh") : t("actions.generate")}
            </Text>
          </View>
        </PekuloButton>
      </View>

      {/* Regulatory Notice Banner */}
      <AdvisoryDisclaimer />

      {/* Provider & Sovereignty Posture */}
      {session && (
        <AdvisoryProviderBadge
          provider={session.provider}
          model={session.model}
          generatedAt={session.createdAt}
        />
      )}

      {isLoading ? (
        <View flexDirection="column" gap="$6" role="status" aria-live="polite">
          <Section ariaLabel={t("actions.generating")}>
            <PekuloSkeleton width="40%" height={12} />
            <View height={12} />
            <PekuloSkeleton block height={60} />
          </Section>
          <div className={styles.grid2Col}>
            <Section ariaLabel={t("sections.strengths")} className={styles.cardStretch}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
            <Section ariaLabel={t("sections.risks")} className={styles.cardStretch}>
              <PekuloSkeleton lines={3} height={20} />
            </Section>
          </div>
        </View>
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
        <View flexDirection="column" gap="$6">
          {/* Synthèse stratégique */}
          <Section ariaLabel={t("sections.overview")} title={t("sections.overview")}>
            <Text color="$colorSecondary" fontSize="$body" lineHeight={24}>
              {session.sessionData.analysis.overview}
            </Text>
          </Section>

          {/* Diagnostic : Forces & Risques */}
          <div className={styles.grid2Col}>
            <Section
              ariaLabel={t("sections.strengths")}
              title={t("sections.strengths")}
              className={styles.cardStretch}
            >
              <View flexDirection="column" gap="$3">
                {session.sessionData.analysis.strengths.map((str) => (
                  <View key={str} flexDirection="row" alignItems="flex-start" gap="$2.5">
                    <CheckCircle2
                      size={16}
                      color="var(--gain)"
                      style={{ flexShrink: 0, marginTop: 3 }}
                      aria-hidden
                    />
                    <Text color="$colorSecondary" fontSize="$bodySm" lineHeight={20} flex={1}>
                      {str}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>

            <Section
              ariaLabel={t("sections.risks")}
              title={t("sections.risks")}
              className={styles.cardStretch}
            >
              <View flexDirection="column" gap="$3">
                {session.sessionData.analysis.risks.map((risk) => (
                  <View key={risk} flexDirection="row" alignItems="flex-start" gap="$2.5">
                    <AlertTriangle
                      size={16}
                      color="var(--warning)"
                      style={{ flexShrink: 0, marginTop: 3 }}
                      aria-hidden
                    />
                    <Text color="$colorSecondary" fontSize="$bodySm" lineHeight={20} flex={1}>
                      {risk}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          </div>

          {/* Orientation d'allocation */}
          <Section
            ariaLabel={t("sections.allocationAdvice")}
            title={t("sections.allocationAdvice")}
          >
            <View flexDirection="row" alignItems="flex-start" gap="$3">
              <PieChart
                size={18}
                color="var(--colorSecondary)"
                style={{ flexShrink: 0, marginTop: 2 }}
                aria-hidden
              />
              <Text color="$colorSecondary" fontSize="$bodySm" lineHeight={22} flex={1}>
                {session.sessionData.analysis.allocationAdvice}
              </Text>
            </View>
          </Section>

          {/* Recommandations d'arbitrage */}
          <Section
            ariaLabel={t("sections.recommendations")}
            title={`${t("sections.recommendations")} (${session.sessionData.analysis.recommendations.length})`}
          >
            <View flexDirection="column" gap="$3">
              {session.sessionData.analysis.recommendations.map((rec) => (
                <AdvisoryRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  provider={session.provider}
                  model={session.model}
                />
              ))}
            </View>
          </Section>
        </View>
      )}
    </View>
  );
}
