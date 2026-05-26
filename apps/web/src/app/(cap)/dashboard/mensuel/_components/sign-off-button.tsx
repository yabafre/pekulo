"use client";

// 5-5 sign-off CTA. Renders the "Clôturer {mois}" button + owns the
// ClotureModal trigger. Outside the close window the button stays
// disabled with a sublabel stating the active window dates (AC-5).
//
// R13 hydration guard (lesson 2026-05-24): `now` starts null and lands
// post-hydration via useEffect — both SSR and first client paint render
// the disabled branch (same DOM); the real branch lights up on second
// paint after `now !== null`. Re-checks every 60 s so the button flips
// when the user keeps the tab open across the window boundary.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { View, Text } from "@pekulo/ui/client";
import { isWithinCloseWindow, closeWindowBounds } from "@/lib/derive/close-window";
import { ClotureModal } from "./cloture-modal";

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

interface SignOffButtonProps {
  year: number;
  monthNum: number;
  derivedIncomeEur: number;
  derivedSpendingEur: number;
  derivedTransfersEur: number;
  derivedNetChangeEur: number;
}

function formatWindow(year: number, monthNum: number): string {
  const { startIso, endIso } = closeWindowBounds(year, monthNum);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(startIso)} → ${fmt(endIso)} UTC`;
}

export function SignOffButton({
  year,
  monthNum,
  derivedIncomeEur,
  derivedSpendingEur,
  derivedTransfersEur,
  derivedNetChangeEur,
}: SignOffButtonProps) {
  const monthName = MONTH_LABELS_FR[monthNum - 1];
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const handle = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(handle);
  }, []);

  const withinWindow = now !== null && isWithinCloseWindow(year, monthNum, now);

  if (!withinWindow) {
    return (
      <>
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
          aria-label={`Clôturer ${monthName} (fenêtre fermée)`}
        >
          <Check size={14} strokeWidth={2} aria-hidden={true} />
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            Clôturer {monthName}
          </Text>
        </View>
        <Text color="$colorTertiary" fontSize="$caption" marginTop="$2">
          Fenêtre de clôture : {formatWindow(year, monthNum)}
        </Text>
      </>
    );
  }

  return (
    <>
      <View
        render="button"
        onPress={() => setOpen(true)}
        flexDirection="row"
        alignItems="center"
        gap="$2"
        marginTop="$4"
        paddingHorizontal="$4"
        height={40}
        borderRadius="$full"
        backgroundColor="$color"
        borderWidth={0}
        cursor="pointer"
        hoverStyle={{ opacity: 0.9 }}
        aria-label={`Clôturer ${monthName}`}
      >
        <Check size={14} strokeWidth={2} aria-hidden={true} />
        <Text color="$background" fontSize="$bodySm" fontWeight="500">
          Clôturer {monthName}
        </Text>
      </View>
      <ClotureModal
        open={open}
        onOpenChange={setOpen}
        year={year}
        monthNum={monthNum}
        derivedIncomeEur={derivedIncomeEur}
        derivedSpendingEur={derivedSpendingEur}
        derivedTransfersEur={derivedTransfersEur}
        derivedNetChangeEur={derivedNetChangeEur}
      />
    </>
  );
}
