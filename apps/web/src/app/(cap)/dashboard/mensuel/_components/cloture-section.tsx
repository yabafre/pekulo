"use client";

// 5-5 cloture section. Three branches:
//   - loading        → skeleton
//   - signed off     → "Clôturé le {date}" + no CTA (reopen lives on the
//                      historique row, per AC-3 surface placement)
//   - not signed     → SignOffButton (active inside close window, disabled
//                      otherwise with the formatWindow sublabel)
//
// The CTA itself + close-window gate live in SignOffButton ; this section
// owns the loading/skeleton + signed-off announcement. R13 hydration guard
// (lesson 2026-05-24) — `!isHydrated || isLoading`.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Section, PekuloSkeleton } from "@pekulo/ui";
import { View, Text } from "@pekulo/ui/client";
import { useMonthly } from "../_hooks/use-monthly";
import { SignOffButton } from "./sign-off-button";

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

export function ClotureSection({ year, monthNum }: ClotureSectionProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const monthly = useMonthly(year, monthNum);

  useEffect(() => setIsHydrated(true), []);

  const monthName = MONTH_LABELS_FR[monthNum - 1];

  if (!isHydrated || monthly.isLoading) {
    return (
      <Section ariaLabel="Action">
        <PekuloSkeleton width="30%" height={12} />
        <View height={12} />
        <PekuloSkeleton lines={2} height={14} />
      </Section>
    );
  }

  if (!monthly.data) {
    return (
      <Section ariaLabel="Action">
        <Text color="$danger" fontSize="$bodySm">
          Erreur de chargement.
        </Text>
      </Section>
    );
  }

  if (monthly.data.source === "persisted" && monthly.data.record.signedOffAt !== null) {
    const signedAt = new Date(monthly.data.record.signedOffAt).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const monthLabel = monthName ?? "";
    const capitalised = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    return (
      <Section ariaLabel="Action">
        <Text color="$colorTertiary" fontSize="$caption">
          Clôture
        </Text>
        <View flexDirection="row" alignItems="center" gap="$2" marginTop="$2">
          <Check size={14} strokeWidth={2} aria-hidden={true} />
          <Text color="$color" fontSize="$bodySm">
            {capitalised} clôturé le {signedAt}.
          </Text>
        </View>
        <Text color="$colorTertiary" fontSize="$caption" marginTop="$3">
          Tu peux réouvrir le mois depuis l'historique.
        </Text>
      </Section>
    );
  }

  return (
    <Section ariaLabel="Action">
      <Text color="$colorTertiary" fontSize="$caption">
        Clôture
      </Text>
      <Text color="$color" fontSize="$bodySm" marginTop="$2">
        Tu peux figer les agrégats de {monthName} pour qu'ils ne soient plus recalculés.
      </Text>
      <SignOffButton
        year={year}
        monthNum={monthNum}
        derivedIncomeEur={monthly.data.record.incomeEur}
        derivedSpendingEur={monthly.data.record.spendingEur}
        derivedTransfersEur={monthly.data.record.transfersEur}
        derivedNetChangeEur={monthly.data.record.netChangeEur}
      />
    </Section>
  );
}
