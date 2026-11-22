"use client";

import { Text, View, styled } from "tamagui";

export type PekuloTopTab = "cap" | "patrimoine";

const TabButton = styled(View, {
  name: "PekuloTopTabButton",
  render: "button",
  role: "tab",
  cursor: "pointer",
  paddingHorizontal: "$1",
  paddingVertical: "$1",
  focusVisibleStyle: {
    outlineColor: "$borderFocus",
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineOffset: 2,
    borderRadius: 4,
  },
});

export interface PekuloTopTabToggleProps {
  topTab: PekuloTopTab;
  onChange: (t: PekuloTopTab) => void;
  /** Localised labels (defaults are French). */
  labels?: { cap?: string; patrimoine?: string; ariaLabel?: string };
}

export function PekuloTopTabToggle({ topTab, onChange, labels }: PekuloTopTabToggleProps) {
  return (
    <View
      flexDirection="row"
      gap="$4"
      role="tablist"
      aria-label={labels?.ariaLabel ?? "Vue cap ou patrimoine"}
    >
      <TabButton onPress={() => onChange("cap")} aria-selected={topTab === "cap"}>
        <Text
          color={(topTab === "cap" ? "$color" : "$colorTertiary") as never}
          fontSize="$h2"
          fontWeight="600"
        >
          {labels?.cap ?? "Cap"}
        </Text>
      </TabButton>
      <TabButton onPress={() => onChange("patrimoine")} aria-selected={topTab === "patrimoine"}>
        <Text
          color={(topTab === "patrimoine" ? "$color" : "$colorTertiary") as never}
          fontSize="$h2"
          fontWeight="600"
        >
          {labels?.patrimoine ?? "Patrimoine"}
        </Text>
      </TabButton>
    </View>
  );
}
