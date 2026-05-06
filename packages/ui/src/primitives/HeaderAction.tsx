"use client";

// packages/ui/src/primitives/HeaderAction.tsx
// Inline pill button for section actions ("+ Ajouter", "Filtrer", "Voir
// tout", "12 mois ▾"). UX spec § HeaderAction.

import type { ComponentType } from "react";
import { Text, View, styled } from "tamagui";

type LucideIcon = ComponentType<{ size?: number | string; color?: string }>;

export interface HeaderActionProps {
  /** Optional left icon. */
  icon?: LucideIcon;
  /** Optional right icon (e.g. ChevronDown). */
  iconRight?: LucideIcon;
  /** Label text. */
  label: string;
  /** Press handler. */
  onPress?: () => void;
  /** Disabled state. */
  disabled?: boolean;
}

const PillButton = styled(View, {
  name: "HeaderActionPill",
  render: "button",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 32,
  paddingHorizontal: 12,
  borderRadius: 9999,
  backgroundColor: "$backgroundMuted",
  cursor: "pointer",
  hoverStyle: {
    backgroundColor: "$backgroundElevated",
  },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
  pressStyle: {
    backgroundColor: "$backgroundElevated",
    scale: 0.97,
  },
  disabledStyle: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

export function HeaderAction({
  icon: Icon,
  iconRight: IconRight,
  label,
  onPress,
  disabled,
}: HeaderActionProps) {
  const handleClick = () => {
    if (disabled) return;
    onPress?.();
  };

  return (
    <PillButton onPress={handleClick} disabled={disabled} aria-disabled={disabled || undefined}>
      {Icon && <Icon size={14} color="currentColor" />}
      <Text color="$color" fontSize={13} fontWeight="500">
        {label}
      </Text>
      {IconRight && <IconRight size={14} color="currentColor" />}
    </PillButton>
  );
}
