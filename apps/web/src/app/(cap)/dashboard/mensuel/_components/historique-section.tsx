"use client";

// Historique section — past N months below 'Mois en cours' via
// PekuloMonthlyRow. Signed-off rows expose a "Réouvrir" action (5-5 AC-3)
// via a sibling MoreHorizontal trigger that opens the ReopenConfirm dialog.

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Section, PekuloMonthlyRow, PekuloSkeleton } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import type { MonthlyDisplayRow } from "@pekulo/types";
import { useMonthlyHistory } from "../_hooks/use-monthly-history";
import { ReopenConfirm } from "./reopen-confirm";

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
  const [reopenTarget, setReopenTarget] = useState<{ year: number; monthNum: number } | null>(null);

  useEffect(() => setIsHydrated(true), []);

  if (!isHydrated || history.isLoading) {
    return (
      <Section ariaLabel="Mois passés" title="Historique">
        <PekuloSkeleton lines={5} height={36} />
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
    <>
      <Section ariaLabel="Mois passés" title="Historique">
        <View flexDirection="column">
          {past.map((item) => {
            // 5-5 AC-4: persisted iff signedOffAt set (T6 discriminator
            // flip). The `closed` flag drives PekuloMonthlyRow's "Clôturé"
            // badge.
            const isSignedOff = item.source === "persisted";
            const row: MonthlyDisplayRow = {
              monthLabel: `${MONTH_LABELS_FR[item.record.monthNum - 1]} ${item.record.year}`,
              incomeEur: item.record.incomeEur,
              spendingEur: item.record.spendingEur,
              netEur: item.record.netChangeEur,
              closed: isSignedOff,
            };
            return (
              <View
                key={`${item.record.year}-${item.record.monthNum}`}
                flexDirection="row"
                alignItems="center"
                gap="$2"
              >
                <View flex={1}>
                  <PekuloMonthlyRow month={row} />
                </View>
                {isSignedOff && (
                  <View
                    render="button"
                    onPress={() =>
                      setReopenTarget({
                        year: item.record.year,
                        monthNum: item.record.monthNum,
                      })
                    }
                    width={32}
                    height={32}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$full"
                    backgroundColor="transparent"
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: "$backgroundMuted" }}
                    aria-label={`Réouvrir ${MONTH_LABELS_FR[item.record.monthNum - 1]} ${item.record.year}`}
                  >
                    <MoreHorizontal size={16} strokeWidth={2} aria-hidden={true} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Section>
      {reopenTarget !== null && (
        <ReopenConfirm
          open={reopenTarget !== null}
          onOpenChange={(next) => {
            if (!next) setReopenTarget(null);
          }}
          year={reopenTarget.year}
          monthNum={reopenTarget.monthNum}
        />
      )}
    </>
  );
}
