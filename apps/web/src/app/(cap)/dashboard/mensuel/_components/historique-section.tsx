"use client";

// Historique section — mirrors ux-preview MonthlyScreen (App.tsx:1586+).
// Renders the past N months below 'Mois en cours' via PekuloMonthlyRow.
// The current month is excluded here because it's already rendered in
// MoisEnCoursSection at the top of the page.

import { useEffect, useState } from "react";
import { Section, PekuloMonthlyRow } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import type { MonthlyDisplayRow } from "@pekulo/types";
import { useMonthlyHistory } from "../_hooks/use-monthly-history";

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

interface HistoriqueSectionProps {
  limit?: number;
}

export function HistoriqueSection({ limit = 6 }: HistoriqueSectionProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const history = useMonthlyHistory(limit);

  useEffect(() => setIsHydrated(true), []);

  if (isHydrated && history.isLoading) {
    return (
      <Section ariaLabel="Mois passés" title="Historique">
        <Text color="$colorTertiary" fontSize="$caption">
          Chargement…
        </Text>
      </Section>
    );
  }

  if (history.error) {
    return (
      <Section ariaLabel="Mois passés" title="Historique">
        <Text color="$danger" fontSize="$bodySm">
          Erreur de chargement.
        </Text>
      </Section>
    );
  }

  if (!history.data) return null;

  // Drop the current month (items[0]) — it's already at the top of the page.
  // The remaining items are the past months in descending order.
  const past = history.data.items.slice(1);

  if (past.length === 0) {
    return (
      <Section ariaLabel="Mois passés" title="Historique">
        <Text color="$colorTertiary" fontSize="$caption">
          Aucun mois passé à afficher.
        </Text>
      </Section>
    );
  }

  return (
    <Section ariaLabel="Mois passés" title="Historique">
      <View flexDirection="column">
        {past.map((item) => {
          const row: MonthlyDisplayRow = {
            monthLabel: `${MONTH_LABELS_FR[item.record.monthNum - 1]} ${item.record.year}`,
            incomeEur: item.record.incomeEur,
            spendingEur: item.record.spendingEur,
            netEur: item.record.netChangeEur,
            closed: item.source === "persisted" && item.record.signedOffAt !== null,
          };
          return (
            <PekuloMonthlyRow key={`${item.record.year}-${item.record.monthNum}`} month={row} />
          );
        })}
      </View>
    </Section>
  );
}
