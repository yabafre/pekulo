// packages/ui/src/components/PekuloActivityRow/PekuloActivityRow.native.tsx
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react-native";
import { Text, View, useTheme } from "tamagui";
import type { Activity } from "@pekulo/types";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface PekuloActivityRowProps {
  tx: Activity;
  categoryPrefix?: ReactNode;
  logo?: ReactNode;
  aiApplied?: boolean;
}

export function PekuloActivityRow({ tx, categoryPrefix, logo, aiApplied }: PekuloActivityRowProps) {
  const theme = useTheme();
  const isInflow = tx.direction === "in";
  const Arrow = isInflow ? ArrowDownRight : ArrowUpRight;
  const arrowColor = isInflow ? theme.success.val : theme.colorTertiary.val;
  const amountColor = isInflow ? "$success" : "$color";
  const sign = isInflow ? "+" : "−";

  return (
    <View flexDirection="row" alignItems="center" gap="$3" paddingVertical="$3">
      {logo}
      <Arrow size={18} color={arrowColor} />
      <View flex={1} minWidth={0}>
        <Text color="$color" fontSize="$bodySm" fontWeight="500" numberOfLines={1}>
          {tx.label}
        </Text>
        <View flexDirection="row" alignItems="center" minWidth={0}>
          <Text color="$colorTertiary" fontSize="$xs" flexShrink={1} minWidth={0} numberOfLines={1}>
            {tx.account} ·{" "}
          </Text>
          {categoryPrefix}
          <Text color="$colorTertiary" fontSize="$xs" flexShrink={0} numberOfLines={1}>
            {tx.category}
          </Text>
          {aiApplied ? (
            <View flexDirection="row" alignItems="center" marginLeft="$1" gap={4} flexShrink={0}>
              <Sparkles size={11} color={theme.colorTertiary.val} />
              <Text color="$colorTertiary" fontSize="$xs">
                IA
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text color={amountColor} fontSize="$bodySm" fontWeight="500" flexShrink={0}>
        {sign}
        {eur0.format(tx.amountEur)}
      </Text>
    </View>
  );
}
