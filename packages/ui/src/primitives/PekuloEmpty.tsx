"use client";

// PekuloEmpty family — shadcn-`Empty` parity. Visual primitive for
// "no data yet" states (empty lists, dashboards without history,
// onboarding placeholders). Compositional: Empty (root) > EmptyHeader
// (media + title + description) + EmptyContent (CTA).

import { View, type ViewProps } from "tamagui";
import type { CSSProperties, ReactNode } from "react";
import { pekuloFontSizes, pekuloFontWeights, pekuloRadius, pekuloSpacing } from "../tokens";

// ─── Empty (root) ────────────────────────────────────────────────────────

export interface PekuloEmptyProps extends Omit<ViewProps, "children"> {
  children?: ReactNode;
}

export function PekuloEmpty({ children, style, ...props }: PekuloEmptyProps) {
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
      style={{ textAlign: "center", ...(style as CSSProperties) }}
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
      // Geometry from the iso-fidelity reference, ux-preview App.tsx:880:
      // `grid h-12 w-12 place-items-center rounded-full bg-muted mb-4`.
      <View
        data-slot="empty-icon"
        data-variant={variant}
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

// Plain <h3>/<p> instead of Tamagui Text — Tamagui's Text component
// resolves line-height from the font config (pekuloLineHeights keys
// don't match pekuloFontSizes keys, so Tamagui falls back or interprets
// numeric tokens as absolute px). Native HTML respects CSS unitless
// line-height as a ratio, so multi-line wrap renders correctly.

export function PekuloEmptyTitle({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <h3
      data-slot="empty-title"
      style={{
        margin: 0,
        color: "var(--color)",
        fontSize: pekuloFontSizes.bodySm,
        fontWeight: pekuloFontWeights.medium,
        letterSpacing: -0.1,
        lineHeight: 1.3,
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </h3>
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
    <p
      data-slot="empty-description"
      // `@pekulo/ui/reset.css` applies `all: unset` to <p> (so Tamagui's
      // `<Text render="p">` can own its own layout). That makes a bare
      // <p> render as `display: inline`, killing line-height on wrapped
      // text. Force `display: block` + width:100% to restore block flow.
      style={{
        display: "block",
        width: "100%",
        margin: 0,
        color: "var(--colorTertiary)",
        fontSize: pekuloFontSizes.bodySm,
        lineHeight: 1.5,
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </p>
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
