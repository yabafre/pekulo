"use client";

import type { ComponentType } from "react";
import { Text, View, styled } from "tamagui";

type LucideIcon = ComponentType<{ size?: number; color?: string }>;

export interface PekuloEmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const CtaPill = styled(View, {
  name: "PekuloEmptyStateCta",
  render: "button",
  role: "button",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  borderRadius: "$full",
  backgroundColor: "$color",
  cursor: "pointer",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
  },
});

export function PekuloEmptyState({
  icon: Icon,
  title,
  message,
  ctaLabel,
  onCta,
}: PekuloEmptyStateProps) {
  return (
    <View alignItems="center" gap="$3" paddingVertical="$8" paddingHorizontal="$6">
      <View
        width={56}
        height={56}
        borderRadius="$full"
        backgroundColor="$backgroundMuted"
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={24} color="var(--colorSecondary)" />
      </View>
      <Text color="$color" fontSize="$h3" fontWeight="600">
        {title}
      </Text>
      <Text color="$colorSecondary" fontSize="$caption" textAlign="center">
        {message}
      </Text>
      {ctaLabel && onCta && (
        <CtaPill onPress={onCta} aria-label={ctaLabel}>
          <Text color="$colorOnAccent" fontSize="$caption" fontWeight="600">
            {ctaLabel}
          </Text>
        </CtaPill>
      )}
    </View>
  );
}
