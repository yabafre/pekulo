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
import { Text, View } from "@pekulo/ui/client";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";

export interface AdvisoryRecommendationCardProps {
  recommendation: AdvisoryRecommendation;
  provider: string;
  model: string;
}

export function AdvisoryRecommendationCard({
  recommendation,
  provider,
  model,
}: AdvisoryRecommendationCardProps) {
  const t = useTranslations("advisory.recommendations");

  const actionColors: Record<
    string,
    { bg: "$backgroundMuted" | "$backgroundElevated"; color: string }
  > = {
    buy: { bg: "$backgroundMuted", color: "var(--positive)" },
    sell: { bg: "$backgroundMuted", color: "var(--negative)" },
    trim: { bg: "$backgroundMuted", color: "var(--warning)" },
    reduce: { bg: "$backgroundMuted", color: "var(--warning)" },
    hold: { bg: "$backgroundMuted", color: "var(--colorSecondary)" },
    rebalance: { bg: "$backgroundMuted", color: "var(--color)" },
    allocate: { bg: "$backgroundMuted", color: "var(--positive)" },
  };

  const actionStyle = actionColors[recommendation.action] ?? {
    bg: "$backgroundMuted",
    color: "var(--colorSecondary)",
  };

  return (
    <View
      backgroundColor="$backgroundElevated"
      borderWidth={1}
      borderColor="$borderDefault"
      borderRadius="$md"
      padding="$4"
      flexDirection="column"
      gap="$3"
    >
      <View
        flexDirection="row"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap="$2"
      >
        <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
          <View
            backgroundColor={actionStyle.bg}
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$xs"
          >
            <Text style={{ color: actionStyle.color }} fontSize="$caption" fontWeight="bold">
              {t(`action.${recommendation.action}`)}
            </Text>
          </View>
          <Text color="$color" fontSize="$body" fontWeight="bold">
            {recommendation.title}
          </Text>
        </View>

        <View
          backgroundColor="$backgroundMuted"
          paddingHorizontal="$2"
          paddingVertical="$1"
          borderRadius="$xs"
        >
          <Text color="$colorSecondary" fontSize="$caption">
            {t(`priority.${recommendation.priority}`)}
          </Text>
        </View>
      </View>

      <View flexDirection="row" alignItems="center" gap="$2">
        <Tag size={14} color="var(--colorSecondary)" aria-hidden />
        <Text color="$colorSecondary" fontSize="$caption">
          {t("target", { target: recommendation.target })}
        </Text>
      </View>

      <View flexDirection="column" gap="$1">
        <Text color="$colorTertiary" fontSize="$caption" fontWeight="medium">
          {t("rationale")}
        </Text>
        <Text color="$color" fontSize="$body" lineHeight="$sm">
          {recommendation.rationale}
        </Text>
      </View>

      {recommendation.instrumentRecommendation && (
        <View
          backgroundColor="$backgroundMuted"
          borderRadius="$sm"
          padding="$3"
          flexDirection="column"
          gap="$2"
        >
          <View flexDirection="row" alignItems="center" gap="$2">
            <ArrowRight size={14} color="var(--color)" aria-hidden />
            <Text color="$color" fontSize="$caption" fontWeight="bold">
              {t("instrument")} {recommendation.instrumentRecommendation.symbol}
              {recommendation.instrumentRecommendation.isin
                ? ` (${recommendation.instrumentRecommendation.isin})`
                : ""}
            </Text>
          </View>
          <Text color="$colorSecondary" fontSize="$caption">
            {recommendation.instrumentRecommendation.rationale}
          </Text>
        </View>
      )}

      <View marginTop="$1">
        <AdvisoryProviderBadge provider={provider} model={model} />
      </View>
    </View>
  );
}
