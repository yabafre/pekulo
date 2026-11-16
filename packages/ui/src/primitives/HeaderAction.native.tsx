// packages/ui/src/primitives/HeaderAction.native.tsx
import type { ComponentType } from "react";
import { Text, View, styled, useTheme } from "tamagui";

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

export interface HeaderActionProps {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

const PillButton = styled(View, {
  name: "HeaderActionPill",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: "$8",
  paddingHorizontal: "$3",
  borderRadius: "$full",
  backgroundColor: "$backgroundMuted",
  pressStyle: {
    backgroundColor: "$backgroundElevated",
    scale: 0.97,
  },
  disabledStyle: {
    opacity: 0.5,
  },
});

export function HeaderAction({
  icon: Icon,
  iconRight: IconRight,
  label,
  onPress,
  disabled,
}: HeaderActionProps) {
  const theme = useTheme();
  const handleClick = () => {
    if (disabled) return;
    onPress?.();
  };

  return (
    <PillButton onPress={handleClick} disabled={disabled} aria-disabled={disabled || undefined}>
      {Icon && <Icon size={14} color={theme.color.val} />}
      <Text color="$color" fontSize="$caption" fontWeight="500">
        {label}
      </Text>
      {IconRight && <IconRight size={14} color={theme.color.val} />}
    </PillButton>
  );
}
