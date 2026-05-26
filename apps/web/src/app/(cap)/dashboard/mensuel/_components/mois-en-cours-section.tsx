"use client";

import { useEffect, useState } from "react";
import { Section, PekuloButton, PekuloStat } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import { useMonthly } from "../_hooks/use-monthly";
import { MonthlyForm } from "./monthly-form";

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
  const [isEditing, setIsEditing] = useState(false);
  const monthly = useMonthly(year, monthNum);

  // R13 (lesson 2026-05-24): gate the loading branch on a hydration flag.
  // SSR + first client render both emit the loading state; real data
  // appears on the second paint after useEffect fires.
  useEffect(() => setIsHydrated(true), []);

  const label = `${MONTH_LABELS_FR[monthNum - 1]} ${year}`;

  if (isHydrated && monthly.isLoading) {
    return (
      <Section ariaLabel="Mois en cours" title={`Mois en cours · ${label}`}>
        <Text color="$colorSecondary">Chargement…</Text>
      </Section>
    );
  }

  if (monthly.error) {
    return (
      <Section ariaLabel="Mois en cours" title={`Mois en cours · ${label}`}>
        <Text color="$danger">Erreur de chargement.</Text>
      </Section>
    );
  }

  if (!monthly.data) return null;

  const { record } = monthly.data;

  if (isEditing) {
    return (
      <Section ariaLabel="Mois en cours" title={`Mois en cours · ${label}`}>
        <MonthlyForm
          year={year}
          monthNum={monthNum}
          defaults={record}
          onSubmitSuccess={() => setIsEditing(false)}
        />
      </Section>
    );
  }

  return (
    <Section
      ariaLabel="Mois en cours"
      title={`Mois en cours · ${label}`}
      action={
        <PekuloButton variant="ghost" onPress={() => setIsEditing(true)}>
          Modifier
        </PekuloButton>
      }
    >
      <View flexDirection="row" gap="$6" flexWrap="wrap">
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
