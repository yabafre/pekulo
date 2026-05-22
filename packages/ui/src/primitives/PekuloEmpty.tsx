"use client";

// PekuloEmpty family — shadcn-`Empty` parity. Visual primitive for
// "no data yet" states (empty lists, dashboards without history,
// onboarding placeholders). Compositional: Empty (root) > EmptyHeader
// (media + title + description) + EmptyContent (CTA).

import { Text, View, type ViewProps } from "tamagui";
import type { CSSProperties, ReactNode } from "react";
import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";

// ─── Empty (root) ────────────────────────────────────────────────────────

export interface PekuloEmptyProps extends Omit<ViewProps, "children"> {
  /** When true, renders a dashed border (`border-dashed` shadcn variant). */
  outlined?: boolean;
  children?: ReactNode;
}

export function PekuloEmpty({ outlined = false, children, style, ...props }: PekuloEmptyProps) {
  return (
    <View
      data-slot="empty"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      borderRadius="$xl"
      width="100%"
      style={
        outlined
          ? {
              border: "1px dashed var(--borderDefault)",
              textAlign: "center",
              ...(style as CSSProperties),
            }
          : { textAlign: "center", ...(style as CSSProperties) }
      }
      {...props}
    >
      {children}
    </View>
  );
}

// ─── EmptyHeader ─────────────────────────────────────────────────────────

export interface PekuloEmptyHeaderProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmptyHeader({ children, ...props }: PekuloEmptyHeaderProps) {
  return (
    <View
      data-slot="empty-header"
      flexDirection="column"
      alignItems="center"
      gap="$2"
      maxWidth={400}
      {...props}
    >
      {children}
    </View>
  );
}

// ─── EmptyMedia ──────────────────────────────────────────────────────────
// Icon slot — `variant="icon"` renders a muted rounded tile (32×32) for
// the icon, `variant="default"` is a transparent passthrough used for
// illustrations / SVGs at their natural size.

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
        data-slot="empty-icon"
        data-variant={variant}
        width={pekuloSpacing[8]}
        height={pekuloSpacing[8]}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$backgroundMuted"
        borderRadius="$lg"
        marginBottom="$2"
        {...props}
      >
        {children}
      </View>
    );
  }
  return (
    <View
      data-slot="empty-icon"
      data-variant={variant}
      alignItems="center"
      justifyContent="center"
      marginBottom="$2"
      {...props}
    >
      {children}
    </View>
  );
}

// ─── EmptyTitle ──────────────────────────────────────────────────────────

export function PekuloEmptyTitle({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Text
      data-slot="empty-title"
      color="$color"
      fontSize={pekuloFontSizes.bodySm}
      fontWeight={pekuloFontWeights.medium}
      letterSpacing={-0.1}
      style={style}
    >
      {children}
    </Text>
  );
}

// ─── EmptyDescription ────────────────────────────────────────────────────

export function PekuloEmptyDescription({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Text
      data-slot="empty-description"
      color="$colorTertiary"
      fontSize={pekuloFontSizes.bodySm}
      lineHeight="$normal"
      style={style}
    >
      {children}
    </Text>
  );
}

// ─── EmptyContent ────────────────────────────────────────────────────────

export interface PekuloEmptyContentProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmptyContent({ children, ...props }: PekuloEmptyContentProps) {
  return (
    <View
      data-slot="empty-content"
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

void pekuloRadius;
