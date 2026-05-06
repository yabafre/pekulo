"use client";

import { Text, View } from "tamagui";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";

export type PekuloLlmRoute = "ios" | "ollama" | "cloud";

export interface PekuloSuggestion {
  label: string;
  account: string;
  dateLabel: string;
  direction: "in" | "out";
  amountEur: number;
  suggestedCategory: string;
  confidence: number;
  route: PekuloLlmRoute;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const ROUTE_LABEL: Record<PekuloLlmRoute, string> = {
  ios: "iOS",
  ollama: "Ollama",
  cloud: "Cloud",
};

export interface PekuloSuggestionRowProps {
  tx: PekuloSuggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
}

export function PekuloSuggestionRow({ tx, onConfirm, onEdit }: PekuloSuggestionRowProps) {
  const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
  const sign = tx.direction === "in" ? "+" : "−";
  return (
    <View flexDirection="column" gap="$2" paddingVertical="$3">
      <View flexDirection="row" alignItems="center" gap="$3">
        <Arrow size={18} color="var(--colorSecondary)" />
        <View flex={1}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500">
            {tx.label}
          </Text>
          <Text color="$colorTertiary" fontSize="$xs">
            {tx.account} · {tx.dateLabel}
          </Text>
        </View>
        <Text color="$color" fontSize="$bodySm" fontWeight="500">
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
          <Sparkles size={12} color="var(--accent)" />
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
        <Text color="$colorTertiary" fontSize="$xs" display="none" $md={{ display: "flex" }}>
          · {ROUTE_LABEL[tx.route]}
        </Text>
        <View flex={1} />
        <View
          render="button"
          role="button"
          onPress={onConfirm}
          paddingHorizontal="$3"
          paddingVertical={6}
          borderRadius="$full"
          backgroundColor="$color"
          cursor="pointer"
          focusVisibleStyle={{
            outlineColor: "$borderFocus",
            outlineStyle: "solid",
            outlineWidth: 2,
          }}
          aria-label="Confirmer la catégorie"
        >
          <Text color="$colorOnAccent" fontSize="$xs" fontWeight="600">
            ✓ Confirmer
          </Text>
        </View>
        <View
          render="button"
          role="button"
          onPress={onEdit}
          paddingHorizontal="$2"
          paddingVertical={6}
          cursor="pointer"
          aria-label="Modifier la catégorie"
        >
          <Text color="$colorSecondary" fontSize="$xs">
            Modifier
          </Text>
        </View>
      </View>
    </View>
  );
}
