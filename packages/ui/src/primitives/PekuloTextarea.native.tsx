// packages/ui/src/primitives/PekuloTextarea.native.tsx
import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "tamagui";
import { PEKULO_NATIVE_BODY_FACE } from "../config/fonts.native";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloTextareaProps extends Omit<TextInputProps, "editable" | "onChange"> {
  invalid?: boolean;
  disabled?: boolean;
  rows?: number;
  "aria-label"?: string;
  onChange?: (event: { target: { value: string } }) => void;
}

export const PekuloTextarea = forwardRef<TextInput, PekuloTextareaProps>(function PekuloTextarea(
  {
    invalid = false,
    disabled,
    rows,
    style,
    accessibilityLabel,
    "aria-label": ariaLabel,
    onChangeText,
    onChange,
    ...props
  },
  ref,
) {
  const theme = useTheme();
  const minHeight = rows ? Math.max(pekuloSpacing[20], rows * 22) : pekuloSpacing[20];

  return (
    <TextInput
      ref={ref}
      multiline
      textAlignVertical="top"
      editable={!disabled}
      accessibilityLabel={accessibilityLabel ?? ariaLabel}
      placeholderTextColor={theme.colorTertiary.val}
      onChangeText={(text) => {
        onChangeText?.(text);
        onChange?.({ target: { value: text } });
      }}
      style={[
        {
          width: "100%",
          minHeight,
          backgroundColor: theme.backgroundMuted.val,
          color: theme.color.val,
          borderRadius: pekuloRadius.lg,
          paddingVertical: pekuloSpacing[2],
          paddingHorizontal: pekuloSpacing[3],
          fontSize: pekuloFontSizes.bodySm,
          fontFamily: PEKULO_NATIVE_BODY_FACE,
          borderWidth: invalid ? 1 : 0,
          borderColor: invalid ? theme.danger.val : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...props}
    />
  );
});
