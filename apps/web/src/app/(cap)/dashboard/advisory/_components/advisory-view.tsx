"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useTranslations } from "next-intl";
import type { AdvisoryStatus } from "@pekulo/validators";
import { PekuloButton, PekuloEmptyState } from "@pekulo/ui";
import { Text, View } from "@pekulo/ui/client";
import { Sparkles, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
import { useAdvisoryLatestSession, useGenerateAdvisoryAnalysis } from "../_hooks/use-advisory";
import { AdvisoryDisclaimer } from "./advisory-disclaimer";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";
import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";

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
    <View
      flexDirection="column"
      gap="$6"
      width="100%"
      maxWidth={880}
      alignSelf="center"
      paddingBottom="$8"
    >
      <AdvisoryDisclaimer />

      <View
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap="$4"
      >
        <View flexDirection="column" gap="$1">
          <Text color="$color" fontSize="$title" fontWeight="bold">
            {t("title")}
          </Text>
          <Text color="$colorSecondary" fontSize="$caption">
            {t("subtitle")}
          </Text>
        </View>

        <PekuloButton
          variant="default"
          size="sm"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="font_body"
        >
          <View flexDirection="row" alignItems="center" gap="$2">
            <Sparkles size={16} color="currentColor" aria-hidden />
            <Text color="$colorOnAccent" fontSize="$body" fontWeight="medium">
              {generateMutation.isPending
                ? t("actions.generating")
                : session
                  ? t("actions.refresh")
                  : t("actions.generate")}
            </Text>
          </View>
        </PekuloButton>
      </View>

      {session && (
        <AdvisoryProviderBadge
          provider={session.provider}
          model={session.model}
          generatedAt={session.createdAt}
        />
      )}

      {isLoading ? (
        <View padding="$8" alignItems="center">
          <Text color="$colorSecondary">{t("actions.generating")}</Text>
        </View>
      ) : !session ? (
        <PekuloEmptyState
          icon={Sparkles}
          title={t("emptyState.title")}
          message={t("emptyState.description")}
          ctaLabel={t("actions.generate")}
          onCta={handleGenerate}
        />
      ) : (
        <View flexDirection="column" gap="$5">
          {/* Overview */}
          <View
            backgroundColor="$backgroundElevated"
            borderWidth={1}
            borderColor="$borderDefault"
            borderRadius="$md"
            padding="$4"
            flexDirection="column"
            gap="$2"
          >
            <Text color="$color" fontSize="$body" fontWeight="bold">
              {t("sections.overview")}
            </Text>
            <Text color="$colorSecondary" fontSize="$body" lineHeight="$sm">
              {session.sessionData.analysis.overview}
            </Text>
          </View>

          {/* Strengths & Risks */}
          <View flexDirection="row" gap="$4" $max-md={{ flexDirection: "column" }}>
            <View
              flex={1}
              backgroundColor="$backgroundElevated"
              borderWidth={1}
              borderColor="$borderDefault"
              borderRadius="$md"
              padding="$4"
              flexDirection="column"
              gap="$2"
            >
              <View flexDirection="row" alignItems="center" gap="$2">
                <CheckCircle2 size={16} color="var(--positive)" aria-hidden />
                <Text color="$color" fontSize="$body" fontWeight="bold">
                  {t("sections.strengths")}
                </Text>
              </View>
              {session.sessionData.analysis.strengths.map((str) => (
                <Text key={str} color="$colorSecondary" fontSize="$caption">
                  • {str}
                </Text>
              ))}
            </View>

            <View
              flex={1}
              backgroundColor="$backgroundElevated"
              borderWidth={1}
              borderColor="$borderDefault"
              borderRadius="$md"
              padding="$4"
              flexDirection="column"
              gap="$2"
            >
              <View flexDirection="row" alignItems="center" gap="$2">
                <AlertTriangle size={16} color="var(--warning)" aria-hidden />
                <Text color="$color" fontSize="$body" fontWeight="bold">
                  {t("sections.risks")}
                </Text>
              </View>
              {session.sessionData.analysis.risks.map((risk) => (
                <Text key={risk} color="$colorSecondary" fontSize="$caption">
                  • {risk}
                </Text>
              ))}
            </View>
          </View>

          {/* Allocation Advice */}
          <View
            backgroundColor="$backgroundElevated"
            borderWidth={1}
            borderColor="$borderDefault"
            borderRadius="$md"
            padding="$4"
            flexDirection="column"
            gap="$2"
          >
            <View flexDirection="row" alignItems="center" gap="$2">
              <PieChart size={16} color="var(--color)" aria-hidden />
              <Text color="$color" fontSize="$body" fontWeight="bold">
                {t("sections.allocationAdvice")}
              </Text>
            </View>
            <Text color="$colorSecondary" fontSize="$body" lineHeight="$sm">
              {session.sessionData.analysis.allocationAdvice}
            </Text>
          </View>

          {/* Recommendations List */}
          <View flexDirection="column" gap="$3">
            <Text color="$color" fontSize="$body" fontWeight="bold">
              {t("sections.recommendations")} ({session.sessionData.analysis.recommendations.length}
              )
            </Text>
            {session.sessionData.analysis.recommendations.map((rec) => (
              <AdvisoryRecommendationCard
                key={rec.id}
                recommendation={rec}
                provider={session.provider}
                model={session.model}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
