"use client";

// Mobile-only primary "+" button, white circle 44 × 44, hidden on lg+.
// Renders only when activeNav ∈ {transactions, portfolio, realestate}.

import { View, styled } from "tamagui";
import { Plus } from "lucide-react";
import type { PekuloNavKey } from "./PekuloNavRail";

const FAB = styled(View, {
  name: "PekuloContextualAddFab",
  render: "button",
  role: "button",
  width: 44,
  height: 44,
  borderRadius: "$full",
  backgroundColor: "$color",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  pressStyle: { scale: 0.95 },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
  $lg: { display: "none" },
});

const SHOW_FOR: PekuloNavKey[] = ["transactions", "portfolio", "realestate"];

export interface PekuloContextualAddButtonProps {
  activeNav: PekuloNavKey;
  label: string;
  onPress: () => void;
}

export function PekuloContextualAddButton({
  activeNav,
  label,
  onPress,
}: PekuloContextualAddButtonProps) {
  if (!SHOW_FOR.includes(activeNav)) return null;
  return (
    <FAB onPress={onPress} aria-label={label}>
      <Plus size={22} color="var(--background)" />
    </FAB>
  );
}
