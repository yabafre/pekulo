"use client";

// packages/ui/src/components/PekuloHero.tsx
// HeroBlock — patrimoine total + delta vs plan. Two variants:
//   - mobile: bare hero (no container — caller wraps in Section)
//   - card: hero + Cap target + Plan/an stats below (used by HeroCard
//     bento cell on desktop)

import { Text, View } from "tamagui";
import { useCountUp } from "../animations/use-count-up";

export interface PekuloHeroProps {
  variant?: "mobile" | "card";
  totalEur: number;
  aheadEur: number;
  targetCapital?: number;
  targetYear?: number;
  requiredYearlyEur?: number;
  label?: string;
}

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatEur = (v: number) => eur0.format(v);
const formatCompactEur = (v: number) => `${eurCompact.format(v)} €`;

export function PekuloHero({
  variant = "mobile",
  totalEur,
  aheadEur,
  targetCapital,
  targetYear,
  requiredYearlyEur,
  label = "Patrimoine total",
}: PekuloHeroProps) {
  const animated = useCountUp(totalEur, { durationMs: 900 });
  const aheadSign = aheadEur >= 0 ? "+" : "−";
  const aheadAbs = formatEur(Math.abs(aheadEur));

  return (
    <View width="100%">
      <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
        {label}
      </Text>
      <Text color="$color" fontSize="$hero" fontWeight="600" letterSpacing={-0.5} marginTop="$2">
        {formatEur(animated)}
      </Text>
      <View flexDirection="row" alignItems="baseline" gap={6} marginTop="$2">
        <Text color="$accent" fontSize="$bodySm" fontWeight="500">
          {aheadSign}
          {aheadAbs}
        </Text>
        <Text color="$colorTertiary" fontSize="$bodySm">
          vs plan · 12 mois
        </Text>
      </View>
      {variant === "card" &&
        targetCapital !== undefined &&
        targetYear !== undefined &&
        requiredYearlyEur !== undefined && (
          <View flexDirection="row" gap="$8" marginTop="$8">
            <View flex={1}>
              <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
                Cap
              </Text>
              <Text color="$color" fontSize="$h2" fontWeight="600" marginTop="$1">
                {formatEur(targetCapital)}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                en {targetYear}
              </Text>
            </View>
            <View flex={1}>
              <Text color="$colorTertiary" fontSize="$xs" letterSpacing={0.5}>
                Plan / an
              </Text>
              <Text color="$color" fontSize="$h2" fontWeight="600" marginTop="$1">
                {formatCompactEur(requiredYearlyEur)}
              </Text>
              <Text color="$colorTertiary" fontSize="$xs">
                linéaire
              </Text>
            </View>
          </View>
        )}
    </View>
  );
}
