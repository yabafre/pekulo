"use client";

import { Text, View, styled } from "tamagui";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
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

// Use `styled.button(...)` (HTML factory) so HTML attributes (`type`,
// `disabled`, `onClick`) are properly typed on the wrapper and forwarded
// to the underlying <button>. focusVisibleStyle stays inline (Tamagui's
// token narrowing widens `$borderFocus` to plain string when spread via
// an intermediate constant — see L18 lesson on StackStyle constraints).
const ConfirmPill = styled.button({
  name: "PekuloSuggestionConfirm",
  paddingHorizontal: "$3",
  paddingVertical: 6,
  borderRadius: "$full",
  borderWidth: 0,
  backgroundColor: "$color",
  cursor: "pointer",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
});

const EditPill = styled.button({
  name: "PekuloSuggestionEdit",
  paddingHorizontal: "$2",
  paddingVertical: 6,
  borderRadius: "$full",
  borderWidth: 0,
  backgroundColor: "transparent",
  cursor: "pointer",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
});

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode };
const ConfirmPillTyped = ConfirmPill as unknown as React.ComponentType<PillButtonProps>;
const EditPillTyped = EditPill as unknown as React.ComponentType<PillButtonProps>;

export interface PekuloSuggestionRowProps {
  tx: Suggestion;
  onConfirm?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  // Story 6-8 — category glyph rendered after the Sparkles AI marker in the
  // chip. The consumer resolves <CategoryIcon> from the raw category key (the
  // row's `tx.suggestedCategory` is the display label, not the key).
  categoryIcon?: ReactNode;
  // Story 6-10 (FR-65) — leading logo avatar (merchant/bank/category). The
  // consumer passes <TransactionLogo src={tx.logoUrl} category={rawCategory} />.
  logo?: ReactNode;
}

export function PekuloSuggestionRow({
  tx,
  onConfirm,
  onEdit,
  disabled,
  categoryIcon,
  logo,
}: PekuloSuggestionRowProps) {
  const Arrow = tx.direction === "in" ? ArrowDownRight : ArrowUpRight;
  const sign = tx.direction === "in" ? "+" : "−";
  return (
    <View flexDirection="column" gap="$2" paddingVertical="$3">
      <View flexDirection="row" alignItems="center" gap="$3">
        {logo}
        <Arrow size={18} color="var(--colorSecondary)" />
        <View flex={1} minWidth={0}>
          <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
            {tx.label}
          </Text>
          {/* Single line — the long Bridge account label ellipsizes instead of
              wrapping to 3 lines (min-w-0 on the column + numberOfLines). */}
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
          {/* Sparkles is chrome (icon next to a label), not a perf delta — TR-strict
              keeps it on the grayscale ramp. */}
          <Sparkles size={12} color="var(--colorSecondary)" />
          {categoryIcon}
          <Text color="$colorSecondary" fontSize="$xs">
            {tx.suggestedCategory}
          </Text>
        </View>
        <Text
          // `$warning` is a documented Pekulo extension (amber) reserved for
          // LLM-confidence labels < 75 %. See packages/ui/src/tokens/colors.ts.
          color={(tx.confidence < 0.75 ? "$warning" : "$colorTertiary") as never}
          fontSize="$xs"
        >
          {Math.round(tx.confidence * 100)}%
        </Text>
        {/* AC-4 (story 6-4): route badge hidden below 640 px. `$sm` is the
            v5-media minWidth:640 key — shown ≥640, hidden under it. (Was `$md`
            = minWidth:768 — corrected in 6-4 review to match the AC.) */}
        <Text color="$colorTertiary" fontSize="$xs" display="none" $sm={{ display: "flex" }}>
          · {ROUTE_LABEL[tx.route]}
        </Text>
        <View flex={1} />
        <ConfirmPillTyped
          type="button"
          disabled={disabled}
          aria-label="Confirmer la catégorie"
          onClick={() => {
            if (!disabled) onConfirm?.();
          }}
        >
          <Text color="$colorOnAccent" fontSize="$xs" fontWeight="600">
            ✓ Confirmer
          </Text>
        </ConfirmPillTyped>
        <EditPillTyped
          type="button"
          disabled={disabled}
          aria-label="Modifier la catégorie"
          onClick={() => {
            if (!disabled) onEdit?.();
          }}
        >
          <Text color="$colorSecondary" fontSize="$xs">
            Modifier
          </Text>
        </EditPillTyped>
      </View>
    </View>
  );
}
