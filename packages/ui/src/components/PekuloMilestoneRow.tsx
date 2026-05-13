"use client";

// packages/ui/src/components/PekuloMilestoneRow.tsx
// Palier row — mini-donut + label + target/year + signed delta + status verbose.
// Status determines delta color: gain (early/on-track) / loss (late) / neutral.

import { Trash2 } from "lucide-react";
import { Text, View, styled } from "tamagui";
import type { MilestoneCardItem, MilestoneStatus } from "@pekulo/types";
import { PekuloDonut } from "./PekuloDonut";

export interface PekuloMilestoneRowProps {
  milestone: MilestoneCardItem;
  /**
   * When provided, renders a delete affordance on the right of the row.
   * The handler receives the milestone's domain `id` (omitted from the
   * call when the item carries no id — legacy mockups don't trigger
   * delete since they aren't wired to a real row). Pending=true keeps
   * the button visible but disables the click + dims it, so optimistic
   * UI rollback after a server error is visually consistent.
   */
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
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

const DeletePill = styled(View, {
  name: "PekuloMilestoneDelete",
  render: "button",
  role: "button",
  width: 32,
  height: 32,
  borderRadius: "$full",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$backgroundMuted" },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
  variants: {
    disabled: {
      true: { opacity: 0.5, cursor: "not-allowed" },
    },
  } as const,
});

export function PekuloMilestoneRow({ milestone, onDelete, isDeleting }: PekuloMilestoneRowProps) {
  const { id, label, targetEur, targetYear, progressPct, deltaEur, status } = milestone;
  const tone =
    status === "ahead" ? "$success" : status === "behind" ? "$danger" : "$colorSecondary";
  const sign = deltaEur >= 0 ? "+" : "−";
  const canDelete = onDelete && id;
  return (
    <View flexDirection="row" alignItems="center" gap="$4" paddingVertical="$3">
      <PekuloDonut pct={progressPct} size={36} stroke={3} />
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
      {canDelete && (
        <DeletePill
          // Tamagui v2 styled(View, { render: "button" }) types as View
          // props — we drop the HTML `type` attribute here because the pill
          // is always rendered as a sibling of any form (never inside one),
          // so the default `type=submit` cannot stray into a form submit.
          disabled={isDeleting}
          aria-disabled={isDeleting}
          aria-label={`Supprimer le palier ${label}`}
          onPress={() => {
            if (!isDeleting) onDelete(id);
          }}
        >
          <Trash2 size={16} color="var(--colorSecondary)" aria-hidden={true} />
        </DeletePill>
      )}
    </View>
  );
}
