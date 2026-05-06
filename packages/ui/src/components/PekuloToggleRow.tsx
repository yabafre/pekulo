"use client";

import { useId } from "react";
import { Text, View, styled } from "tamagui";

export interface PekuloToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const Switch = styled(View, {
  name: "PekuloToggleRowSwitch",
  render: "button",
  width: 44,
  height: 26,
  borderRadius: "$full",
  cursor: "pointer",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
  variants: {
    checked: {
      true: { backgroundColor: "$accent" },
      false: { backgroundColor: "$backgroundMuted" },
    },
    disabled: { true: { opacity: 0.5, cursor: "not-allowed" } },
  } as const,
});

const Knob = styled(View, {
  name: "PekuloToggleRowKnob",
  width: 22,
  height: 22,
  borderRadius: "$full",
  backgroundColor: "$colorOnAccent",
  position: "absolute",
  top: 2,
});

export function PekuloToggleRow({
  label,
  sub,
  checked,
  onChange,
  disabled,
}: PekuloToggleRowProps) {
  const id = useId();
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <View flex={1}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500" htmlFor={id} render="label">
          {label}
        </Text>
        {sub && (
          <Text color="$colorTertiary" fontSize="$xs">
            {sub}
          </Text>
        )}
      </View>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onPress={() => {
          if (!disabled) onChange(!checked);
        }}
      >
        <Knob left={checked ? 20 : 2} />
      </Switch>
    </View>
  );
}
