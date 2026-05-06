"use client";

// apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx
// Faithful port of HeroBlock (variant="card") from docs/ux-preview/src/App.tsx
// L381-417 onto Tamagui primitives. Mock values come from
// docs/ux-preview/src/data/mock.ts (WEALTH.totalEur, WEALTH.curve12m[0].plan,
// WEALTH.required12mEur, COMPASS.targetCapital, COMPASS.targetYear) so the
// rendered numbers match the canonical UX preview exactly:
//   - totalEur          = 180 400 €
//   - ahead vs plan 12m = 21 383 € (totalEur − curve12m[0].plan = 180_400 − 159_017)
//   - targetCapital     = 800 000 € en 2055
//   - required12mEur    ≈ 21,4k € linéaire
//
// Tamagui v2-rc.41 obliges 'use client' on every component that imports its
// primitives — verified by repeated build attempts: a Server-Component leaf
// importing <View>/<Text> from `tamagui` triggers `(0 , j.createContext) is
// not a function` in Turbopack's SSR pass. Tamagui's own App-Router example
// in https://tamagui.dev/docs/guides/next-js puts 'use client' on
// app/page.tsx. AC-1's strictest reading ("only the provider declares
// 'use client'") therefore fails on this RC; recorded as the canonical W2
// pivot signal in the T6 decision doc.
//
// Discipline contract (T4.3 grep audits):
//   1. ZERO card decoration tokens — surfaces rely on backgroundCard contrast
//      against background. No borderColor / borderWidth / outline / boxShadow
//      / shadowColor allowed.
//   2. The single emerald accent ($accent) appears EXACTLY once: on the
//      gain delta line. Labels, headings, neutral chrome must use
//      $color / $colorSecondary / $colorTertiary.

import { Text, View } from "tamagui";

const TOTAL_EUR = 180_400;
const PLAN_12M_START = 159_017;
const AHEAD_EUR = TOTAL_EUR - PLAN_12M_START;
const TARGET_CAPITAL = 800_000;
const TARGET_YEAR = 2055;
const REQUIRED_12M_EUR = 21_383;

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurCompact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatEur(value: number): string {
  return eur0.format(value);
}

function formatCompactEur(value: number): string {
  return `${eurCompact.format(value)} €`;
}

export function HeroBlock() {
  const aheadSign = AHEAD_EUR >= 0 ? "+" : "−";
  const aheadAbs = formatEur(Math.abs(AHEAD_EUR));

  // Theme wrapper retiré — TamaguiProvider porte déjà defaultTheme="pekulo-dark"
  // (provider.tsx). Un <Theme> imbriqué crée un sub-ThemeContext consumer
  // redondant qui déclenche un re-render + atomic-CSS lookup à chaque mount.
  return (
    <View
      backgroundColor="$backgroundCard"
      borderRadius={16}
      padding={24}
      width="100%"
      maxWidth={520}
    >
      <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
        Patrimoine total
      </Text>
      <Text color="$color" fontSize={44} fontWeight="600" letterSpacing={-0.5} marginTop={8}>
        {formatEur(TOTAL_EUR)}
      </Text>

      <View flexDirection="row" alignItems="baseline" gap={6} marginTop={8}>
        <Text color="$accent" fontSize={14} fontWeight="500">
          {aheadSign}
          {aheadAbs}
        </Text>
        <Text color="$colorTertiary" fontSize={14}>
          vs plan · 12 mois
        </Text>
      </View>

      <View flexDirection="row" gap={32} marginTop={32}>
        <View flex={1}>
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
            Cap
          </Text>
          <Text color="$color" fontSize={20} fontWeight="600" marginTop={4}>
            {formatEur(TARGET_CAPITAL)}
          </Text>
          <Text color="$colorTertiary" fontSize={12}>
            en {TARGET_YEAR}
          </Text>
        </View>

        <View flex={1}>
          <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
            Plan / an
          </Text>
          <Text color="$color" fontSize={20} fontWeight="600" marginTop={4}>
            {formatCompactEur(REQUIRED_12M_EUR)}
          </Text>
          <Text color="$colorTertiary" fontSize={12}>
            linéaire
          </Text>
        </View>
      </View>
    </View>
  );
}
