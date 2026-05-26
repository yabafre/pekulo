"use client";

// Cloture section — placeholder for story 5-5 (sign-off). Surfaces the
// disabled "Clôturer {mois}" button per ux-preview MonthlyScreen
// (App.tsx:1573-1583). 5-5 will wire the button to upsertMonthly with
// signedOffAt set + flip disabled off when the month's transactions are
// fully categorised.

import { Check } from "lucide-react";
import { Section } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";

const MONTH_LABELS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

interface ClotureSectionProps {
  year: number;
  monthNum: number;
}

export function ClotureSection({ monthNum }: ClotureSectionProps) {
  const monthName = MONTH_LABELS_FR[monthNum - 1];
  return (
    <Section ariaLabel="Action">
      <Text color="$colorTertiary" fontSize="$caption">
        Clôture
      </Text>
      <Text color="$color" fontSize="$bodySm" marginTop="$2">
        Le mois en cours sera clôturable une fois toutes les transactions catégorisées.
      </Text>
      <View
        render="button"
        disabled
        flexDirection="row"
        alignItems="center"
        gap="$2"
        marginTop="$4"
        paddingHorizontal="$4"
        height={40}
        borderRadius="$full"
        backgroundColor="$backgroundMuted"
        borderWidth={0}
        opacity={0.5}
        cursor="not-allowed"
      >
        <Check size={14} strokeWidth={2} aria-hidden={true} />
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          Clôturer {monthName}
        </Text>
      </View>
    </Section>
  );
}
