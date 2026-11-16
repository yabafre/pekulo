// packages/ui/src/primitives/PekuloNativeSelect.native.tsx
import { Picker } from "@react-native-picker/picker";
import { Children, isValidElement, useMemo, useState, type ReactNode } from "react";
import { View, useTheme } from "tamagui";
import { pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloNativeSelectOption {
  value: string;
  label: string;
}

export interface PekuloNativeSelectProps {
  controlSize?: "sm" | "md";
  invalid?: boolean;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  options?: ReadonlyArray<PekuloNativeSelectOption>;
  children?: ReactNode;
  onValueChange?: (value: string) => void;
  onChange?: (event: { target: { value: string } }) => void;
  accessibilityLabel?: string;
  "aria-label"?: string;
  testID?: string;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloNativeSelectProps["controlSize"]>, number> = {
  sm: pekuloSpacing[8],
  md: pekuloSpacing[10],
};

function extractOptions(
  options: ReadonlyArray<PekuloNativeSelectOption> | undefined,
  children: ReactNode,
): PekuloNativeSelectOption[] {
  if (options) return [...options];
  const resolved: PekuloNativeSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string; label?: string; children?: ReactNode };
    if (props.value !== undefined) {
      const label =
        props.label ??
        (typeof props.children === "string" || typeof props.children === "number"
          ? String(props.children)
          : props.value);
      resolved.push({ value: String(props.value), label });
    }
  });
  return resolved;
}

export function PekuloNativeSelect({
  controlSize = "md",
  invalid = false,
  disabled = false,
  value: controlledValue,
  defaultValue,
  options,
  children,
  onValueChange,
  onChange,
  accessibilityLabel,
  "aria-label": ariaLabel,
  testID,
}: PekuloNativeSelectProps) {
  const theme = useTheme();
  const items = useMemo(() => extractOptions(options, children), [options, children]);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? items[0]?.value ?? "");
  const selectedValue = controlledValue ?? uncontrolled;

  return (
    <View
      width="100%"
      minHeight={SIZE_HEIGHT[controlSize]}
      backgroundColor="$backgroundMuted"
      borderRadius={pekuloRadius.lg}
      borderWidth={invalid ? 1 : 0}
      borderColor={invalid ? "$danger" : "transparent"}
      opacity={disabled ? 0.5 : 1}
      justifyContent="center"
      overflow="hidden"
    >
      <Picker
        testID={testID}
        enabled={!disabled}
        selectedValue={selectedValue}
        accessibilityLabel={accessibilityLabel ?? ariaLabel}
        dropdownIconColor={theme.colorTertiary.val}
        style={{ color: theme.color.val, width: "100%" }}
        onValueChange={(nextValue) => {
          const str = String(nextValue);
          if (controlledValue === undefined) {
            setUncontrolled(str);
          }
          onValueChange?.(str);
          onChange?.({ target: { value: str } });
        }}
      >
        {items.map((opt) => (
          <Picker.Item
            key={opt.value}
            label={opt.label}
            value={opt.value}
            color={theme.color.val}
          />
        ))}
      </Picker>
    </View>
  );
}
