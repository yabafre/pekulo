"use client";

// apps/web/src/app/(spike)/tamagui-spike/proto-slice.tsx
// Tamagui v2-rc.41 obliges 'use client' on every component that imports its
// primitives — verified by repeated build attempts: a Server-Component leaf
// importing <View>/<Text> from `tamagui` triggers `(0 , j.createContext) is
// not a function` in Turbopack's SSR pass (the runtime pulls React's context
// API through a bundle path that breaks under Next 16 Turbopack). Tamagui's
// own App-Router example in https://tamagui.dev/docs/guides/next-js puts
// 'use client' on `app/page.tsx`. AC-1's strictest reading ("only the provider
// declares 'use client'") therefore fails on this RC; the practical pattern
// is provider + every Tamagui-consuming component as client.
//
// Discipline contract (still enforced by T4.3 grep):
//   1. ZERO card borders — surfaces rely on backgroundCard contrast against background.
//   2. accent.500 (emerald) appears on EXACTLY one element: the monetary delta.
//      Labels, headings, neutral chrome must use color / colorSecondary / colorTertiary.
//   3. No shadowColor / boxShadow / outline — flat dark surfaces only (Trade Republic
//      fidelity per project_pekulo_style_references memory).
//
// grep audit (run in T4.3):
//   grep -nE "(borderColor|borderWidth|outline|boxShadow|shadowColor)" proto-slice.tsx
//   → must return ZERO matches.

import { Text, Theme, View } from "tamagui";

export interface ProtoSliceProps {
  totalWealthEur: number;
  compassPercentage: number;
  nextMilestoneDeltaEur: number;
  nextMilestoneLabel: string;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

export function ProtoSlice(props: ProtoSliceProps) {
  const { totalWealthEur, compassPercentage, nextMilestoneDeltaEur, nextMilestoneLabel } = props;
  const deltaSign = nextMilestoneDeltaEur >= 0 ? "+" : "−";
  const deltaAbsoluteEur = formatEur(Math.abs(nextMilestoneDeltaEur));

  return (
    <Theme name="pekulo-dark">
      <View
        backgroundColor="$backgroundCard"
        borderRadius={16}
        padding={24}
        width="100%"
        maxWidth={520}
      >
      <View gap={4}>
        <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
          PATRIMOINE TOTAL
        </Text>
        <Text color="$color" fontSize={44} fontWeight="600" letterSpacing={-0.5}>
          {formatEur(totalWealthEur)}
        </Text>
      </View>

      <View gap={4} marginTop={20}>
        <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
          CAP
        </Text>
        <Text color="$colorSecondary" fontSize={20}>
          {formatPercentage(compassPercentage)}
        </Text>
      </View>

      <View gap={4} marginTop={20}>
        <Text color="$colorTertiary" fontSize={12} letterSpacing={0.5}>
          PROCHAINE ÉTAPE
        </Text>
        <View flexDirection="row" alignItems="baseline" gap={8}>
          <Text color="$colorSecondary" fontSize={16}>
            {nextMilestoneLabel}
          </Text>
          <Text color="$accent" fontSize={16} fontWeight="600">
            {deltaSign}
            {deltaAbsoluteEur}
          </Text>
        </View>
      </View>
      </View>
    </Theme>
  );
}
