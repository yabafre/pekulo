"use client";

import type { ReactNode } from "react";
import { Text, View } from "tamagui";

export interface PekuloSettingRowProps {
  label: string;
  value?: string;
  sub?: string;
  action?: ReactNode;
  destructive?: boolean;
}

export function PekuloSettingRow({
  label,
  value,
  sub,
  action,
  destructive,
}: PekuloSettingRowProps) {
  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      <View flex={1}>
        <Text
          color={(destructive ? "$danger" : "$color") as never}
          fontSize="$bodySm"
          fontWeight="500"
        >
          {label}
        </Text>
        {sub && (
          <Text color="$colorTertiary" fontSize="$xs">
            {sub}
          </Text>
        )}
      </View>
      {value && (
        <Text color="$colorSecondary" fontSize="$bodySm">
          {value}
        </Text>
      )}
      {action}
    </View>
  );
}
