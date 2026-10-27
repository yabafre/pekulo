"use client";

// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useTranslations } from "next-intl";
import { Cpu, ShieldCheck } from "lucide-react";
import { Text, View } from "@pekulo/ui/client";

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
    <View
      role="note"
      aria-label={t("posture")}
      flexDirection="row"
      flexWrap="wrap"
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      backgroundColor="$backgroundMuted"
      borderRadius="$full"
      alignSelf="flex-start"
    >
      <View flexDirection="row" alignItems="center" gap="$1.5">
        <Cpu size={13} color="var(--colorSecondary)" aria-hidden />
        <Text color="$colorSecondary" fontSize="$caption" fontWeight="500">
          {provider} / {model}
        </Text>
      </View>

      <Text color="$colorTertiary" fontSize="$caption">
        ·
      </Text>

      <View flexDirection="row" alignItems="center" gap="$1.5">
        <ShieldCheck size={13} color="var(--gain)" aria-hidden />
        <Text color="$colorSecondary" fontSize="$caption">
          {t("posture")}
        </Text>
      </View>

      {formattedDate && (
        <>
          <Text color="$colorTertiary" fontSize="$caption">
            ·
          </Text>
          <Text color="$colorTertiary" fontSize="$caption">
            {t("generatedAt", { date: formattedDate })}
          </Text>
        </>
      )}
    </View>
  );
}
