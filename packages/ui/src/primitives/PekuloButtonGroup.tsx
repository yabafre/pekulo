"use client";

// PekuloButtonGroup — wraps a set of PekuloButton (and friends) into a
// segmented control. Horizontal by default (e.g. tab-style toolbar);
// vertical for stacked menus. Shadcn-parity for the API surface but the
// edge-flattening (rounded only on first/last child) is handled by data
// attributes the consumer's PekuloButton already exposes.

import { Text, View, type ViewProps } from "tamagui";
import type { ReactNode } from "react";
import { pekuloFontSizes, pekuloRadius, pekuloSpacing } from "../tokens";

const GROUP_CSS = `
[data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
[data-slot="button-group"][data-orientation="horizontal"] > [data-slot="button"]:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; margin-right: -1px; }
[data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:first-child) { border-top-left-radius: 0; border-top-right-radius: 0; }
[data-slot="button-group"][data-orientation="vertical"] > [data-slot="button"]:not(:last-child) { border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: -1px; }
`;

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
    <>
      <style href="pekulo-button-group" precedence="medium">
        {GROUP_CSS}
      </style>
      <View
        role="group"
        data-slot="button-group"
        data-orientation={orientation}
        flexDirection={orientation === "horizontal" ? "row" : "column"}
        alignItems="stretch"
        style={{ width: "fit-content" }}
        {...props}
      >
        {children}
      </View>
    </>
  );
}

// ─── PekuloButtonGroupText ───────────────────────────────────────────────
// Inline label slot inside a ButtonGroup — e.g. a unit suffix between two
// adjusters. Renders as a non-interactive surface that matches the button
// height + borderRadius so the segmented row stays visually flush.

export interface PekuloButtonGroupTextProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloButtonGroupText({ children, ...props }: PekuloButtonGroupTextProps) {
  return (
    <View
      data-slot="button-group-text"
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

// ─── PekuloButtonGroupSeparator ──────────────────────────────────────────

export interface PekuloButtonGroupSeparatorProps extends Omit<ViewProps, "children"> {
  orientation?: "horizontal" | "vertical";
}

export function PekuloButtonGroupSeparator({
  orientation = "vertical",
  ...props
}: PekuloButtonGroupSeparatorProps) {
  return (
    <View
      data-slot="button-group-separator"
      data-orientation={orientation}
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
