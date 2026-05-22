"use client";

// PekuloCard family — shadcn-`Card` parity for the Pekulo DS.
//
// Coexists with `Section` (also a primitive). The choice between the two:
//   - Section — opinionated header bar with `title` + `action` slot props.
//                Best for sections that always have a tertiary action and
//                no body footer (e.g. the immobilier PropertyCard wrapper,
//                the cap-page hero blocks).
//   - PekuloCard — compositional. Header / Title / Description / Action /
//                  Content / Footer as discrete sub-components, like
//                  shadcn. Best for richer cards (settings groups, list
//                  containers with a footer CTA, multi-row dashboards).
//
// Both render on `$backgroundCard`. Pick whichever matches the shape of
// the content. We don't migrate Section consumers to Card — that's a
// future audit.

import { View, type ViewProps } from "tamagui";
import type { ReactNode } from "react";

export type PekuloCardSize = "default" | "sm";

export interface PekuloCardProps extends Omit<ViewProps, "children"> {
  size?: PekuloCardSize;
  children?: ReactNode;
}

const SIZE_GAP: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

const SIZE_PADDING_Y: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

const SIZE_PADDING_X: Record<PekuloCardSize, "$3" | "$4"> = {
  default: "$4",
  sm: "$3",
};

export function PekuloCard({ size = "default", children, ...props }: PekuloCardProps) {
  return (
    <View
      data-slot="card"
      data-size={size}
      flexDirection="column"
      gap={SIZE_GAP[size]}
      paddingVertical={SIZE_PADDING_Y[size]}
      backgroundColor="$backgroundCard"
      borderRadius="$xl"
      overflow="hidden"
      {...props}
    >
      {children}
    </View>
  );
}

// ─── CardHeader ──────────────────────────────────────────────────────────

export interface PekuloCardHeaderProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardHeader({ children, ...props }: PekuloCardHeaderProps) {
  return (
    <View
      data-slot="card-header"
      flexDirection="row"
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$3"
      paddingHorizontal={SIZE_PADDING_X.default}
      {...props}
    >
      {children}
    </View>
  );
}

// ─── CardTitle ───────────────────────────────────────────────────────────

import { Text, type TextProps } from "tamagui";

export function PekuloCardTitle(props: TextProps) {
  return (
    <Text data-slot="card-title" color="$color" fontSize="$body" fontWeight="500" {...props} />
  );
}

// ─── CardDescription ─────────────────────────────────────────────────────

export function PekuloCardDescription(props: TextProps) {
  return (
    <Text data-slot="card-description" color="$colorTertiary" fontSize="$caption" {...props} />
  );
}

// ─── CardAction ──────────────────────────────────────────────────────────
// Right-aligned slot in the header (replaces shadcn's grid-column trick
// with explicit flex alignment, which works equally well in our row-flex
// header).

export interface PekuloCardActionProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardAction({ children, ...props }: PekuloCardActionProps) {
  return (
    <View data-slot="card-action" flexShrink={0} alignSelf="flex-start" {...props}>
      {children}
    </View>
  );
}

// ─── CardContent ─────────────────────────────────────────────────────────

export interface PekuloCardContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardContent({ children, ...props }: PekuloCardContentProps) {
  return (
    <View data-slot="card-content" paddingHorizontal={SIZE_PADDING_X.default} {...props}>
      {children}
    </View>
  );
}

// ─── CardFooter ──────────────────────────────────────────────────────────

export interface PekuloCardFooterProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloCardFooter({ children, ...props }: PekuloCardFooterProps) {
  return (
    <View
      data-slot="card-footer"
      flexDirection="row"
      alignItems="center"
      gap="$3"
      padding="$4"
      borderTopWidth={1}
      borderTopColor="$borderDefault"
      backgroundColor="$backgroundMuted"
      {...props}
    >
      {children}
    </View>
  );
}
