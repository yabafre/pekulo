"use client";

import { Text, View, styled } from "tamagui";

export interface PekuloUserDotProps {
  /** First letter (uppercased internally). */
  initial: string;
  onPress?: () => void;
}

const Bubble = styled(View, {
  name: "PekuloUserDotBubble",
  render: "button",
  role: "button",
  width: 44,
  height: 44,
  borderRadius: "$full",
  backgroundColor: "$backgroundMuted",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$backgroundElevated" },
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
  },
  $lg: { width: "$10", height: "$10" },
});

export function PekuloUserDot({ initial, onPress }: PekuloUserDotProps) {
  return (
    <Bubble onPress={onPress} aria-label="Compte utilisateur">
      <Text color="$color" fontSize="$body" fontWeight="600">
        {initial.charAt(0).toUpperCase()}
      </Text>
    </Bubble>
  );
}
