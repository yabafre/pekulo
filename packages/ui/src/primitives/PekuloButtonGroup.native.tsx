// packages/ui/src/primitives/PekuloButtonGroup.native.tsx
import type { ReactNode } from "react";
import { Text, View, type ViewProps } from "tamagui";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

export interface PekuloButtonGroupProps extends Omit<ViewProps, "children"> {
  orientation?: "horizontal" | "vertical";
  children?: ReactNode;
}

export function PekuloButtonGroup({
  orientation = "horizontal",
  children,
  ...props
}: PekuloButtonGroupProps) {
  return (
    <View
      role="group"
      flexDirection={orientation === "horizontal" ? "row" : "column"}
      alignItems="stretch"
      alignSelf="flex-start"
      gap="$1"
      {...props}
    >
      {children}
    </View>
  );
}

export interface PekuloButtonGroupTextProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloButtonGroupText({ children, ...props }: PekuloButtonGroupTextProps) {
  return (
    <View
      flexDirection="row"
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      backgroundColor="$backgroundMuted"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$borderDefault"
      {...props}
    >
      <Text color="$color" fontSize={pekuloFontSizes.bodySm} fontWeight="500">
        {children}
      </Text>
    </View>
  );
}

export interface PekuloButtonGroupSeparatorProps extends Omit<ViewProps, "children"> {
  orientation?: "horizontal" | "vertical";
}

export function PekuloButtonGroupSeparator({
  orientation = "vertical",
  ...props
}: PekuloButtonGroupSeparatorProps) {
  return (
    <View
      alignSelf="stretch"
      backgroundColor="$borderDefault"
      width={orientation === "vertical" ? 1 : undefined}
      height={orientation === "horizontal" ? 1 : undefined}
      marginHorizontal={orientation === "vertical" ? pekuloSpacing[1] / 4 : 0}
      marginVertical={orientation === "horizontal" ? pekuloSpacing[1] / 4 : 0}
      borderRadius={pekuloRadius.none}
      {...props}
    />
  );
}
