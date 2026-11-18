// packages/ui/src/primitives/PekuloEmpty.native.tsx
import type { ReactNode } from "react";
import { Text, View, type TextProps, type ViewProps } from "tamagui";
import { pekuloFontSizes, pekuloFontWeights, pekuloSpacing } from "../tokens";

export interface PekuloEmptyProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmpty({ children, ...props }: PekuloEmptyProps) {
  return (
    <View
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      borderRadius="$xl"
      width="100%"
      {...props}
    >
      {children}
    </View>
  );
}

export interface PekuloEmptyHeaderProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmptyHeader({ children, ...props }: PekuloEmptyHeaderProps) {
  return (
    <View flexDirection="column" alignItems="center" gap="$2" maxWidth={400} {...props}>
      {children}
    </View>
  );
}

export type PekuloEmptyMediaVariant = "default" | "icon";

export interface PekuloEmptyMediaProps extends Omit<ViewProps, "children"> {
  variant?: PekuloEmptyMediaVariant;
  children?: ReactNode;
}

export function PekuloEmptyMedia({
  variant = "default",
  children,
  ...props
}: PekuloEmptyMediaProps) {
  if (variant === "icon") {
    return (
      <View
        width={pekuloSpacing[12]}
        height={pekuloSpacing[12]}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$backgroundMuted"
        borderRadius="$full"
        marginBottom="$4"
        {...props}
      >
        {children}
      </View>
    );
  }
  return (
    <View alignItems="center" justifyContent="center" marginBottom="$2" {...props}>
      {children}
    </View>
  );
}

export function PekuloEmptyTitle({ children, ...props }: TextProps) {
  return (
    <Text
      color="$color"
      fontSize={pekuloFontSizes.bodySm}
      fontWeight={pekuloFontWeights.medium}
      letterSpacing={-0.1}
      textAlign="center"
      {...props}
    >
      {children}
    </Text>
  );
}

export function PekuloEmptyDescription({ children, ...props }: TextProps) {
  return (
    <Text
      color="$colorTertiary"
      fontSize={pekuloFontSizes.bodySm}
      textAlign="center"
      width="100%"
      {...props}
    >
      {children}
    </Text>
  );
}

export interface PekuloEmptyContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmptyContent({ children, ...props }: PekuloEmptyContentProps) {
  return (
    <View
      flexDirection="column"
      alignItems="center"
      gap="$3"
      maxWidth={400}
      width="100%"
      {...props}
    >
      {children}
    </View>
  );
}
