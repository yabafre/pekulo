"use client";

// apps/web/src/components/auth/auth-shell.tsx
// Shared TR-strict auth UI kit (story 8-1 visual refonte). One source of truth
// for the login / signup / recover / auth-code-error screens so they stay
// pixel-identical. Aesthetic = Trade-Republic fidelity: pure #000 page (set by
// the (auth) layout), a barely-lifted #0a0a0a card with NO border, grayscale
// chrome, a single white CTA, generous spacing, and a visible focus ring on
// every interactive element. Text colour/size on the styled <input> is applied
// via inline CSS vars (not in Tamagui's StackStyle) — use `authInputTextStyle`.

import type { ReactNode } from "react";
import { pekuloFontSizes } from "@pekulo/ui";
import { Text, View, styled } from "@pekulo/ui/client";

/** Inline text styling for the bare <input> (color/fontSize are CSS-only). */
export const authInputTextStyle = {
  color: "var(--color)",
  fontSize: pekuloFontSizes.body,
} as const;

export const AuthInput = styled.input({
  width: "100%",
  height: 48,
  backgroundColor: "$backgroundMuted",
  borderWidth: 1,
  borderColor: "$borderDefault",
  borderRadius: "$lg",
  paddingHorizontal: "$4",
  outlineWidth: 0,
  hoverStyle: { borderColor: "$borderStrong" },
  focusStyle: { borderColor: "$borderFocus" },
  focusVisibleStyle: {
    borderColor: "$borderFocus",
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
});

export const AuthSubmitButton = styled.button({
  width: "100%",
  height: 48,
  backgroundColor: "$color",
  borderRadius: "$full",
  borderWidth: 0,
  outlineWidth: 0,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  cursor: "pointer",
  hoverStyle: { opacity: 0.92 },
  pressStyle: { opacity: 0.85 },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
});

/** A labelled field row. */
export function AuthField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <View flexDirection="column" gap="$2">
      <Text
        color="$colorSecondary"
        fontSize="$caption"
        fontWeight="500"
        render="label"
        htmlFor={htmlFor}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * Full-bleed centred auth screen: brand wordmark on pure black, a borderless
 * card holding the form, and an optional footer line under the card.
 */
export function AuthScreen({
  subtitle,
  ariaLabel,
  children,
  footer,
}: {
  subtitle: string;
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View
      minHeight="100dvh"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$4"
      paddingVertical="$10"
    >
      <View width="100%" maxWidth={400} flexDirection="column" gap="$6">
        <View alignItems="center" gap="$2">
          <Text color="$color" fontSize="$display" fontWeight="700" letterSpacing={-0.5}>
            Pekulo
          </Text>
          <Text color="$colorTertiary" fontSize="$bodySm" textAlign="center">
            {subtitle}
          </Text>
        </View>
        <View
          render="section"
          aria-label={ariaLabel}
          backgroundColor="$backgroundCard"
          borderRadius="$xl"
          padding="$6"
        >
          {children}
        </View>
        {footer ? <View alignItems="center">{footer}</View> : null}
      </View>
    </View>
  );
}
