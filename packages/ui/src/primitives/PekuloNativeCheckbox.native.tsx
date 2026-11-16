// packages/ui/src/primitives/PekuloNativeCheckbox.native.tsx
import { Check } from "lucide-react-native";
import { useState } from "react";
import { View, styled, useTheme } from "tamagui";

const CheckboxBox = styled(View, {
  name: "PekuloNativeCheckboxBox",
  role: "checkbox",
  borderRadius: "$sm",
  alignItems: "center",
  justifyContent: "center",
});

export interface PekuloNativeCheckboxProps {
  size?: number;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (event: { target: { checked: boolean } }) => void;
  accessibilityLabel?: string;
  "aria-label"?: string;
  testID?: string;
}

export function PekuloNativeCheckbox({
  size = 20,
  checked: controlledChecked,
  defaultChecked = false,
  disabled = false,
  onCheckedChange,
  onChange,
  accessibilityLabel,
  "aria-label": ariaLabel,
  testID,
}: PekuloNativeCheckboxProps) {
  const theme = useTheme();
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const isChecked = controlledChecked ?? uncontrolled;

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (controlledChecked === undefined) {
      setUncontrolled(next);
    }
    onCheckedChange?.(next);
    onChange?.({ target: { checked: next } });
  };

  return (
    <CheckboxBox
      testID={testID}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-checked={isChecked}
      aria-disabled={disabled}
      onPress={toggle}
      width={size}
      height={size}
      backgroundColor={isChecked ? "$color" : "$backgroundMuted"}
      opacity={disabled ? 0.5 : 1}
    >
      {isChecked && <Check size={Math.round(size * 0.7)} color={theme.colorOnAccent.val} />}
    </CheckboxBox>
  );
}
