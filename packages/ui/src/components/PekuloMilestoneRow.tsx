"use client";

// packages/ui/src/components/PekuloMilestoneRow.tsx
// Palier row — mini-donut + label + target/year + signed delta + status verbose.
// Status determines delta color: gain (early/on-track) / loss (late) / neutral.

import { Text, View } from "tamagui";
import type { Milestone, MilestoneStatus } from "@pekulo/types";
import { PekuloDonut } from "./PekuloDonut";

export interface PekuloMilestoneRowProps {
  milestone: Milestone;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const STATUS_LABEL: Record<MilestoneStatus, string> = {
  ahead: "en avance",
  "on-track": "sur la trajectoire",
  behind: "en retard",
};

export function PekuloMilestoneRow({ milestone }: PekuloMilestoneRowProps) {
  const { label, targetEur, targetYear, progressPct, deltaEur, status } = milestone;
  const tone =
    status === "ahead" ? "$success" : status === "behind" ? "$danger" : "$colorSecondary";
  const sign = deltaEur >= 0 ? "+" : "−";
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <PekuloDonut pct={progressPct} size={32} stroke={3} />
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
          {label}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {eur0.format(targetEur)} · {targetYear}
        </Text>
      </View>
      <View alignItems="flex-end">
        <Text color={tone as never} fontSize="$bodySm" fontWeight="500">
          {sign}
          {eur0.format(Math.abs(deltaEur))}
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          {STATUS_LABEL[status]}
        </Text>
      </View>
    </View>
  );
}
