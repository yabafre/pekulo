// packages/ui/src/components/PekuloSegmentedControl/PekuloSegmentedControl.native.tsx
import type { ComponentType } from "react";
import { Text, View, styled, useTheme } from "tamagui";

type IconComponent = ComponentType<{ size?: number; color?: string }>;

export interface PekuloSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon: IconComponent;
}

export interface PekuloSegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: PekuloSegmentedOption<T>[];
  ariaLabel: string;
}

const Segment = styled(View, {
  name: "PekuloSegmentedNative",
  role: "radio",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  flex: 1,
  flexBasis: 0,
  minWidth: 0,
  height: 36,
  borderRadius: "$md",
  variants: {
    active: {
      true: { backgroundColor: "$backgroundElevated" },
      false: { backgroundColor: "transparent" },
    },
  } as const,
});

export function PekuloSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: PekuloSegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View
      role="radiogroup"
      aria-label={ariaLabel}
      flexDirection="row"
      padding={4}
      backgroundColor="$backgroundMuted"
      borderRadius="$lg"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <Segment
            key={opt.value}
            active={active}
            onPress={() => onChange(opt.value)}
            aria-checked={active}
          >
            <Icon size={14} color={active ? theme.color.val : theme.colorSecondary.val} />
            <Text
              color={(active ? "$color" : "$colorSecondary") as never}
              fontSize="$caption"
              fontWeight="500"
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Segment>
        );
      })}
    </View>
  );
}
