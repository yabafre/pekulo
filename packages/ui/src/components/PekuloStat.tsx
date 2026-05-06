"use client";

import { Text, View } from "tamagui";

export interface PekuloStatProps {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}

export function PekuloStat({ label, value, tone }: PekuloStatProps) {
  const valueColor = tone === "gain" ? "$success" : tone === "loss" ? "$danger" : "$color";
  return (
    <View>
      <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
        {label}
      </Text>
      <Text color={valueColor as never} fontSize="$h2" fontWeight="600" marginTop="$1">
        {value}
      </Text>
    </View>
  );
}
