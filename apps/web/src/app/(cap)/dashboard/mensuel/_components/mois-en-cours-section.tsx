"use client";

import { useEffect, useState } from "react";
import { Section, PekuloStat } from "@pekulo/ui";
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

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface MoisEnCoursSectionProps {
  year: number;
  monthNum: number;
}

export function MoisEnCoursSection({ year, monthNum }: MoisEnCoursSectionProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const monthly = useMonthly(year, monthNum);

  // R13 (lesson 2026-05-24): hydration guard so SSR + first client paint
  // both emit the loading state and React 19 doesn't flag mismatch.
  useEffect(() => setIsHydrated(true), []);

  const label = `${MONTH_LABELS_FR[monthNum - 1]} ${year}`;

  if (isHydrated && monthly.isLoading) {
    return (
      <Section ariaLabel="Mois en cours">
        <Text color="$colorTertiary" fontSize="$caption">
          Chargement…
        </Text>
      </Section>
    );
  }

  if (monthly.error) {
    return (
      <Section ariaLabel="Mois en cours">
        <Text color="$danger" fontSize="$bodySm">
          Erreur de chargement.
        </Text>
      </Section>
    );
  }

  if (!monthly.data) return null;

  const { record } = monthly.data;

  return (
    <Section ariaLabel="Mois en cours">
      <Text color="$colorTertiary" fontSize="$caption">
        {label} · en cours
      </Text>
      <View flexDirection="row" gap="$6" marginTop="$3" flexWrap="wrap">
        <PekuloStat label="Entrées" value={eur0.format(record.incomeEur)} />
        <PekuloStat label="Sorties" value={eur0.format(record.spendingEur)} />
        <PekuloStat
          label="Net"
          value={eur0.format(record.netChangeEur)}
          tone={record.netChangeEur >= 0 ? "gain" : "loss"}
        />
      </View>
    </Section>
  );
}
