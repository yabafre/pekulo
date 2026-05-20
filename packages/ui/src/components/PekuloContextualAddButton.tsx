"use client";

// Mobile-only primary "+" button, white circle 44 × 44, hidden on lg+.
// The consumer decides on which screens to render this — the primitive
// itself is a pure styled button. (Earlier versions baked a SHOW_FOR
// nav-key allowlist; that decision belongs to the route shell, not the
// DS — Pekulo's cap screen also surfaces the global "Nouvelle
// transaction" action even though ux-preview's L284-300 mock does not.)

import { View, styled } from "tamagui";
import { Plus } from "lucide-react";

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

export interface PekuloContextualAddButtonProps {
  label: string;
  onPress: () => void;
}

export function PekuloContextualAddButton({ label, onPress }: PekuloContextualAddButtonProps) {
  return (
    <FAB onPress={onPress} aria-label={label}>
      <Plus size={22} color="var(--background)" />
    </FAB>
  );
}
