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

  const actionStyle: Record<string, { bg: string; color: string }> = {
    buy: { bg: "rgba(0, 210, 106, 0.12)", color: "var(--gain)" },
    sell: { bg: "rgba(255, 92, 92, 0.12)", color: "var(--loss)" },
    trim: { bg: "rgba(251, 191, 36, 0.12)", color: "var(--warning)" },
    reduce: { bg: "rgba(251, 191, 36, 0.12)", color: "var(--warning)" },
    hold: { bg: "var(--surface-muted)", color: "var(--colorSecondary)" },
    rebalance: { bg: "rgba(47, 115, 255, 0.12)", color: "var(--data-blue)" },
    allocate: { bg: "rgba(0, 210, 106, 0.12)", color: "var(--gain)" },
  };

  const style = actionStyle[recommendation.action] ?? {
    bg: "var(--surface-muted)",
    color: "var(--colorSecondary)",
  };

  return (
    <View
      backgroundColor="$backgroundElevated"
      borderRadius="$lg"
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
        <View flexDirection="row" alignItems="center" gap="$2.5" flexWrap="wrap" flex={1}>
          <View
            style={{ backgroundColor: style.bg }}
            paddingHorizontal="$2.5"
            paddingVertical={4}
            borderRadius="$xs"
          >
            <Text
              style={{ color: style.color }}
              fontSize={11}
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {t(`action.${recommendation.action}`)}
            </Text>
          </View>
          <Text color="$color" fontSize="$body" fontWeight="600" flex={1}>
            {recommendation.title}
          </Text>
        </View>

        <View
          backgroundColor="$backgroundMuted"
          paddingHorizontal="$2.5"
          paddingVertical={3}
          borderRadius="$full"
        >
          <Text color="$colorTertiary" fontSize={11} fontWeight="500">
            {t(`priority.${recommendation.priority}`)}
          </Text>
        </View>
      </View>

      <View flexDirection="row" alignItems="center" gap="$1.5">
        <Tag size={13} color="var(--colorTertiary)" aria-hidden />
        <Text color="$colorTertiary" fontSize="$caption">
          {t("target", { target: recommendation.target })}
        </Text>
      </View>

      <Text color="$colorSecondary" fontSize="$bodySm" lineHeight={20}>
        {recommendation.rationale}
      </Text>

      {recommendation.instrumentRecommendation && (
        <View
          backgroundColor="$backgroundMuted"
          borderRadius="$md"
          padding="$3"
          flexDirection="column"
          gap="$1.5"
        >
          <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
            <ArrowRight size={13} color="var(--colorSecondary)" aria-hidden />
            <Text
              color="$color"
              fontSize="$caption"
              fontWeight="600"
              fontVariant={["tabular-nums"]}
            >
              {recommendation.instrumentRecommendation.symbol}
            </Text>
            {recommendation.instrumentRecommendation.isin && (
              <Text color="$colorTertiary" fontSize={11} fontVariant={["tabular-nums"]}>
                ({recommendation.instrumentRecommendation.isin})
              </Text>
            )}
          </View>
          <Text color="$colorSecondary" fontSize="$caption" lineHeight={18}>
            {recommendation.instrumentRecommendation.rationale}
          </Text>
        </View>
      )}
    </View>
  );
}
