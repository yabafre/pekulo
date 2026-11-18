// packages/ui/src/primitives/PekuloButton.native.tsx
import type { ReactNode } from "react";
import type { GestureResponderEvent, ViewStyle } from "react-native";
import { Text, View, styled, useTheme, type ViewProps } from "tamagui";
import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";
import { PekuloSpinner } from "./PekuloSpinner.native";

export type PekuloButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

export type PekuloButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export interface PekuloButtonProps extends Omit<
  ViewProps,
  "children" | "onPress" | "onClick" | "disabled" | "style"
> {
  variant?: PekuloButtonVariant;
  size?: PekuloButtonSize;
  loading?: boolean;
  loadingLabel?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onClick?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  "aria-label"?: string;
  testID?: string;
  style?: ViewStyle;
  type?: "button" | "submit" | "reset";
}

const ButtonSurface = styled(View, {
  name: "PekuloButtonSurface",
  role: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
});

const SIZE_DIMS: Record<
  PekuloButtonSize,
  { height: number; paddingX?: number; iconOnly?: boolean; fontSize: number; gap: number }
> = {
  default: {
    height: pekuloSpacing[8],
    paddingX: pekuloSpacing[3],
    fontSize: pekuloFontSizes.bodySm,
    gap: 6,
  },
  xs: {
    height: pekuloSpacing[6],
    paddingX: pekuloSpacing[2],
    fontSize: pekuloFontSizes.xs,
    gap: 4,
  },
  sm: { height: 28, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.caption, gap: 4 },
  lg: { height: 36, paddingX: pekuloSpacing[3], fontSize: pekuloFontSizes.bodySm, gap: 6 },
  icon: { height: pekuloSpacing[8], iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
  "icon-xs": { height: pekuloSpacing[6], iconOnly: true, fontSize: pekuloFontSizes.xs, gap: 0 },
  "icon-sm": { height: 28, iconOnly: true, fontSize: pekuloFontSizes.caption, gap: 0 },
  "icon-lg": { height: 36, iconOnly: true, fontSize: pekuloFontSizes.bodySm, gap: 0 },
};

export function PekuloButton({
  variant = "default",
  size = "default",
  loading = false,
  loadingLabel,
  disabled,
  children,
  onPress,
  onClick,
  accessibilityLabel,
  "aria-label": ariaLabel,
  testID,
  style,
  type: _type,
  ...rest
}: PekuloButtonProps) {
  const theme = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const dims = SIZE_DIMS[size];
  const mergedPress = onPress ?? onClick;

  const bgToken =
    variant === "default"
      ? "$color"
      : variant === "secondary"
        ? "$backgroundMuted"
        : variant === "destructive"
          ? "$danger"
          : "transparent";

  const fgColor =
    variant === "default" || variant === "destructive" ? theme.colorOnAccent.val : theme.color.val;

  const labelNode = loading && loadingLabel !== undefined ? loadingLabel : children;

  return (
    <ButtonSurface
      {...rest}
      testID={testID}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-busy={loading}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : mergedPress}
      gap={dims.gap}
      height={dims.height}
      width={dims.iconOnly ? dims.height : undefined}
      paddingHorizontal={dims.iconOnly ? 0 : dims.paddingX}
      borderRadius={size === "xs" || size === "icon-xs" ? pekuloRadius.md : pekuloRadius.lg}
      backgroundColor={bgToken}
      borderWidth={variant === "outline" ? 1 : 0}
      borderColor={variant === "outline" ? "$borderDefault" : "transparent"}
      opacity={isDisabled ? 0.5 : 1}
      pressStyle={isDisabled ? undefined : { opacity: 0.9 }}
      style={style}
    >
      {loading && <PekuloSpinner size={dims.fontSize - 2} color={fgColor} ariaLabel="" />}
      {typeof labelNode === "string" || typeof labelNode === "number" ? (
        <Text
          color={fgColor}
          fontSize={dims.fontSize}
          fontWeight={pekuloFontWeights.medium}
          textDecorationLine={variant === "link" ? "underline" : "none"}
        >
          {labelNode}
        </Text>
      ) : (
        labelNode
      )}
    </ButtonSurface>
  );
}
