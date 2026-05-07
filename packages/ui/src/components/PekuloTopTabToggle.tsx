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
}

export function PekuloTopTabToggle({ topTab, onChange }: PekuloTopTabToggleProps) {
  return (
    <View flexDirection="row" gap="$4" role="tablist" aria-label="Vue cap ou patrimoine">
      <TabButton onPress={() => onChange("cap")} aria-selected={topTab === "cap"}>
        <Text
          color={(topTab === "cap" ? "$color" : "$colorTertiary") as never}
          fontSize="$h2"
          fontWeight="600"
        >
          Cap
        </Text>
      </TabButton>
      <TabButton onPress={() => onChange("patrimoine")} aria-selected={topTab === "patrimoine"}>
        <Text
          color={(topTab === "patrimoine" ? "$color" : "$colorTertiary") as never}
          fontSize="$h2"
          fontWeight="600"
        >
          Patrimoine
        </Text>
      </TabButton>
    </View>
  );
}
