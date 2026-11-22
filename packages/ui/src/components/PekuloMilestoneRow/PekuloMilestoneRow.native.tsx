// packages/ui/src/components/PekuloMilestoneRow/PekuloMilestoneRow.native.tsx
import { Trash2 } from "lucide-react-native";
import { Text, View, styled, useTheme } from "tamagui";
import type { MilestoneCardItem, MilestoneStatus } from "@pekulo/types";
import { PekuloDonut } from "../PekuloDonut/PekuloDonut.native";

export interface PekuloMilestoneRowProps {
  milestone: MilestoneCardItem;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  /** Localised status labels (defaults are French). */
  statusLabels?: Partial<Record<MilestoneStatus, string>>;
  /** Localised accessible name for the delete button. */
  deleteAriaLabel?: (label: string) => string;
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
  role: "button",
  width: 32,
  height: 32,
  borderRadius: "$full",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  pressStyle: { backgroundColor: "$backgroundMuted" },
  variants: {
    disabled: {
      true: { opacity: 0.5 },
    },
  } as const,
});

export function PekuloMilestoneRow({
  milestone,
  onDelete,
  isDeleting,
  statusLabels,
  deleteAriaLabel,
}: PekuloMilestoneRowProps) {
  const theme = useTheme();
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
          {statusLabels?.[status] ?? STATUS_LABEL[status]}
        </Text>
      </View>
      {canDelete && (
        <DeletePill
          disabled={isDeleting}
          aria-disabled={isDeleting}
          aria-label={deleteAriaLabel ? deleteAriaLabel(label) : `Supprimer le palier ${label}`}
          onPress={() => {
            if (!isDeleting) onDelete(id);
          }}
        >
          <Trash2 size={16} color={theme.colorSecondary.val} />
        </DeletePill>
      )}
    </View>
  );
}
