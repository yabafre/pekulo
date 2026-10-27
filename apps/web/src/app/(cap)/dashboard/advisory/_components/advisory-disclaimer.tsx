"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { Text, View } from "@pekulo/ui/client";

export function AdvisoryDisclaimer() {
  const t = useTranslations("advisory");

  return (
    <View
      role="region"
      aria-label={t("disclaimer.title")}
      backgroundColor="$backgroundMuted"
      borderWidth={1}
      borderColor="$borderDefault"
      borderRadius="$md"
      padding="$4"
      flexDirection="column"
      gap="$2"
    >
      <View flexDirection="row" alignItems="center" gap="$2">
        <ShieldAlert size={18} color="var(--warning)" aria-hidden />
        <View
          backgroundColor="$backgroundElevated"
          paddingHorizontal="$2"
          paddingVertical="$1"
          borderRadius="$xs"
        >
          <Text color="$warning" fontSize="$caption" fontWeight="bold">
            {t("disclaimer.badge")}
          </Text>
        </View>
        <Text color="$color" fontSize="$body" fontWeight="bold">
          {t("disclaimer.title")}
        </Text>
      </View>
      <Text color="$colorSecondary" fontSize="$caption" lineHeight="$sm">
        {t("disclaimer.body")}
      </Text>
    </View>
  );
}
