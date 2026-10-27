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
      flexDirection="row"
      alignItems="flex-start"
      gap="$3"
      paddingVertical="$3.5"
      paddingHorizontal="$4"
      borderRadius="$lg"
      backgroundColor="$backgroundMuted"
    >
      <ShieldAlert
        size={16}
        color="var(--warning)"
        style={{ flexShrink: 0, marginTop: 2 }}
        aria-hidden
      />
      <View flexDirection="column" gap="$1" flex={1}>
        <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
          <Text color="$color" fontSize="$bodySm" fontWeight="600">
            {t("disclaimer.title")}
          </Text>
          <View
            backgroundColor="$backgroundElevated"
            paddingHorizontal="$2"
            paddingVertical={2}
            borderRadius="$xs"
          >
            <Text
              color="$warning"
              fontSize={11}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {t("disclaimer.badge")}
            </Text>
          </View>
        </View>
        <Text color="$colorSecondary" fontSize="$caption" lineHeight={18}>
          {t("disclaimer.body")}
        </Text>
      </View>
    </View>
  );
}
