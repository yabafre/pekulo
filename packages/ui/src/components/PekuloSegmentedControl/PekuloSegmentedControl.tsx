"use client";

import type { ComponentType } from "react";
import { Text, View, styled } from "tamagui";

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

export interface PekuloSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export interface PekuloSegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: PekuloSegmentedOption<T>[];
  ariaLabel: string;
}

const Segment = styled(View, {
  name: "PekuloSegmented",
  render: "button",
  role: "radio",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  flex: 1,
  height: 36,
  borderRadius: "$md",
  cursor: "pointer",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
  variants: {
    active: {
      true: { backgroundColor: "$backgroundElevated" },
    },
  } as const,
});

export function PekuloSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: PekuloSegmentedControlProps<T>) {
  return (
    <View
      role="radiogroup"
      aria-label={ariaLabel}
      flexDirection="row"
      gap="$1"
      padding="$1"
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
            <Icon size={14} color="currentColor" />
            <Text
              color={(active ? "$color" : "$colorSecondary") as never}
              fontSize="$caption"
              fontWeight="500"
            >
              {opt.label}
            </Text>
          </Segment>
        );
      })}
    </View>
  );
}
