"use client";

// Cloture section — placeholder for story 5-5 (sign-off). Surfaces the
// disabled "Clôturer {mois}" button per ux-preview MonthlyScreen
// (App.tsx:1573-1583). Consumes useMonthly so it shares the same loading
// state as MoisEnCoursSection — without this, ClotureSection (which has
// no fetch of its own) would render its static content immediately while
// the sibling section is still in flight, producing the visual desync
// Alex reported (Clôture pops before Mois en cours appears).
//
// 5-5 will read `signedOffAt` from this same hook to disable/enable the
// button + wire its onPress to a sign-off mutation.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Section, PekuloSkeleton, type SectionProps } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import { useMonthly } from "../_hooks/use-monthly";

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
  className?: SectionProps["className"];
}

export function ClotureSection({ year, monthNum, className }: ClotureSectionProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const monthly = useMonthly(year, monthNum);

  useEffect(() => setIsHydrated(true), []);

  const monthName = MONTH_LABELS_FR[monthNum - 1];

  if (isHydrated && monthly.isLoading) {
    return (
      <Section ariaLabel="Action" className={className}>
        <PekuloSkeleton width="30%" height={12} />
        <View height={12} />
        <PekuloSkeleton lines={2} height={14} />
      </Section>
    );
  }

  return (
    <Section ariaLabel="Action" className={className}>
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
