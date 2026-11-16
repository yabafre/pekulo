// packages/ui/src/primitives/PekuloInput.native.tsx
import { Eye, EyeOff } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Pressable, TextInput, type TextInputProps } from "react-native";
import { View, useTheme } from "tamagui";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

type AllowedInputType =
  | "text"
  | "number"
  | "email"
  | "password"
  | "tel"
  | "url"
  | "search"
  | "time"
  | "month"
  | "week"
  | "color"
  | "hidden";

export interface PekuloInputProps extends Omit<TextInputProps, "editable" | "onChange"> {
  controlSize?: "sm" | "md";
  invalid?: boolean;
  type?: AllowedInputType;
  revealable?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  onChange?: (event: { target: { value: string } }) => void;
}

const SIZE_HEIGHT: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[8],
  md: pekuloSpacing[10],
};

const SIZE_PADDING_X: Record<NonNullable<PekuloInputProps["controlSize"]>, number> = {
  sm: pekuloSpacing[2],
  md: pekuloSpacing[3],
};

const REVEAL_BTN_WIDTH = 36;

export const PekuloInput = forwardRef<TextInput, PekuloInputProps>(function PekuloInput(
  {
    controlSize = "md",
    invalid = false,
    type = "text",
    revealable,
    disabled,
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
  const [revealed, setRevealed] = useState(false);

  if (type === "hidden") return null;

  const isPassword = type === "password";
  const showRevealToggle = isPassword && (revealable ?? true);
  const paddingRight = showRevealToggle ? REVEAL_BTN_WIDTH : SIZE_PADDING_X[controlSize];

  const keyboardType =
    type === "email"
      ? "email-address"
      : type === "number"
        ? "numeric"
        : type === "tel"
          ? "phone-pad"
          : type === "url"
            ? "url"
            : "default";

  const autoCapitalize =
    type === "email" || type === "password" || type === "url" ? "none" : props.autoCapitalize;

  return (
    <View position="relative" width="100%">
      <TextInput
        ref={ref}
        editable={!disabled}
        secureTextEntry={isPassword && (!showRevealToggle || !revealed)}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={accessibilityLabel ?? ariaLabel}
        placeholderTextColor={theme.colorTertiary.val}
        onChangeText={(text) => {
          onChangeText?.(text);
          onChange?.({ target: { value: text } });
        }}
        style={[
          {
            width: "100%",
            height: SIZE_HEIGHT[controlSize],
            backgroundColor: theme.backgroundMuted.val,
            color: theme.color.val,
            borderRadius: pekuloRadius.lg,
            paddingLeft: SIZE_PADDING_X[controlSize],
            paddingRight,
            fontSize: pekuloFontSizes.bodySm,
            borderWidth: invalid ? 1 : 0,
            borderColor: invalid ? theme.danger.val : "transparent",
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
        {...props}
      />
      {showRevealToggle && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          accessibilityState={{ selected: revealed }}
          onPress={() => setRevealed((v) => !v)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: SIZE_HEIGHT[controlSize],
            width: REVEAL_BTN_WIDTH,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {revealed ? (
            <EyeOff size={16} color={theme.colorTertiary.val} />
          ) : (
            <Eye size={16} color={theme.colorTertiary.val} />
          )}
        </Pressable>
      )}
    </View>
  );
});
