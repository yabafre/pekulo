// packages/ui/src/components/PekuloSuggestionRow/PekuloSuggestionRow.native.tsx
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react-native";
import { Text, View, styled, useTheme } from "tamagui";
import type { LlmRouteBadge, Suggestion } from "@pekulo/types";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const ROUTE_LABEL: Record<LlmRouteBadge, string> = {
  ios: "iOS",
  ollama: "Ollama",
  cloud: "Cloud",
};

const ConfirmPill = styled(View, {
  name: "PekuloSuggestionConfirm",
  role: "button",
  paddingHorizontal: "$3",
  paddingVertical: 6,
  borderRadius: "$full",
  backgroundColor: "$color",
  pressStyle: { opacity: 0.9 },
});

const EditPill = styled(View, {
  name: "PekuloSuggestionEdit",
  role: "button",
  paddingHorizontal: "$2",
  paddingVertical: 6,
  borderRadius: "$full",
  backgroundColor: "transparent",
  pressStyle: { backgroundColor: "$backgroundMuted" },
});

export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  categoryIcon?: ReactNode;
  logo?: ReactNode;
  /** Localised labels (defaults are French). */
  labels?: { confirm?: string; confirmAria?: string; editAria?: string };
}

export function PekuloSuggestionRow({
  tx,
  onConfirm,
  onEdit,
  disabled,
  categoryIcon,
  logo,
  labels,
}: PekuloSuggestionRowProps) {
  const theme = useTheme();
  const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
  const sign = tx.direction === "in" ? "+" : "−";

  return (
    <View flexDirection="column" gap="$2" paddingVertical="$3">
      <View flexDirection="row" alignItems="center" gap="$3">
        {logo}
        <Arrow size={18} color={theme.colorSecondary.val} />
        <View flex={1} minWidth={0}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
            {tx.label}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs" numberOfLines={1}>
            {tx.account} · {tx.dateLabel}
          </Text>
        </View>
        <Text color="$color" fontSize="$bodySm" fontWeight="500" flexShrink={0}>
          {sign}
          {eur0.format(tx.amountEur)}
        </Text>
      </View>
      <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
        <View
          flexDirection="row"
          alignItems="center"
          gap="$1"
          paddingHorizontal="$2"
          paddingVertical={3}
          borderRadius="$full"
          backgroundColor="$backgroundMuted"
        >
          <Sparkles size={12} color={theme.colorSecondary.val} />
          {categoryIcon}
          <Text color="$colorSecondary" fontSize="$xs">
            {tx.suggestedCategory}
          </Text>
        </View>
        <Text
          color={(tx.confidence < 0.75 ? "$warning" : "$colorTertiary") as never}
          fontSize="$xs"
        >
          {Math.round(tx.confidence * 100)}%
        </Text>
        <Text color="$colorTertiary" fontSize="$xs">
          · {ROUTE_LABEL[tx.route]}
        </Text>
        <View flex={1} />
        <ConfirmPill
          disabled={disabled}
          aria-disabled={disabled}
          aria-label={labels?.confirmAria ?? "Confirmer la catégorie"}
          opacity={disabled ? 0.5 : 1}
          onPress={() => {
            if (!disabled) onConfirm?.();
          }}
        >
          <Text color="$colorOnAccent" fontSize="$xs" fontWeight="600">
            ✓ {labels?.confirm ?? "Confirmer"}
          </Text>
        </ConfirmPill>
        <EditPill
          disabled={disabled}
          aria-disabled={disabled}
          aria-label={labels?.editAria ?? "Modifier la catégorie"}
          opacity={disabled ? 0.5 : 1}
          onPress={() => {
            if (!disabled) onEdit?.();
          }}
        >
          <Text color="$colorSecondary" fontSize="$xs">
            Modifier
          </Text>
        </EditPill>
      </View>
    </View>
  );
}
