// packages/ui/src/primitives/PekuloResizable.native.tsx
import type { ReactNode } from "react";
import { View, type ViewProps } from "tamagui";

export interface PekuloResizablePanelGroupProps extends Omit<ViewProps, "children"> {
  orientation?: "horizontal" | "vertical";
  children?: ReactNode;
}

export function PekuloResizablePanelGroup({
  orientation = "horizontal",
  children,
  ...props
}: PekuloResizablePanelGroupProps) {
  return (
    <View
      width="100%"
      height="100%"
      flexDirection={orientation === "vertical" ? "column" : "row"}
      {...props}
    >
      {children}
    </View>
  );
}

export interface PekuloResizablePanelProps extends Omit<ViewProps, "children"> {
  defaultSize?: number;
  children?: ReactNode;
}

export function PekuloResizablePanel({
  defaultSize,
  children,
  ...props
}: PekuloResizablePanelProps) {
  return (
    <View flex={defaultSize ?? 1} minWidth={0} minHeight={0} {...props}>
      {children}
    </View>
  );
}

export interface PekuloResizableHandleProps extends Omit<ViewProps, "children"> {
  withHandle?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function PekuloResizableHandle({
  withHandle = false,
  orientation = "horizontal",
  ...props
}: PekuloResizableHandleProps) {
  const isVertical = orientation === "vertical";
  return (
    <View
      alignItems="center"
      justifyContent="center"
      backgroundColor="$borderDefault"
      width={isVertical ? "100%" : 1}
      height={isVertical ? 1 : "100%"}
      {...props}
    >
      {withHandle && (
        <View
          width={isVertical ? 24 : 4}
          height={isVertical ? 4 : 24}
          borderRadius="$md"
          backgroundColor="$borderDefault"
        />
      )}
    </View>
  );
}
