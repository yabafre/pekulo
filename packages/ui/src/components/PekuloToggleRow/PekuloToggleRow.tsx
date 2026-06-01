"use client";

import { useId } from "react";
import { Text, View } from "tamagui";
import { PekuloSwitch } from "../../primitives/PekuloSwitch";

export interface PekuloToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

// shadcn "Field orientation=horizontal" layout: label + description on the
// left, the control on the right. The control is the shared PekuloSwitch
// primitive — NOT a hand-rolled track/knob (ADR-0007, DRY). PekuloSwitch owns
// the TR-strict grayscale track+thumb flip + its own thumb, so no child here.
export function PekuloToggleRow({ label, sub, checked, onChange, disabled }: PekuloToggleRowProps) {
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
      <PekuloSwitch
        id={id}
        checked={checked}
        disabled={disabled}
        opacity={disabled ? 0.5 : 1}
        aria-label={label}
        onCheckedChange={(v) => {
          if (!disabled) onChange(v);
        }}
      />
    </View>
  );
}
