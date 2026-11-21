// apps/mobile/app/(tabs)/_layout.tsx
// AC-3 (verbatim from story 10-2-mobile-app-bootstrap:38):
//   Given the mobile navigation shell, When the application launches at the
//   root route, Then the Cap tab renders as the initial screen, all five
//   primary destinations (`Cap`, `Transactions`, `Mensuel`, `Portefeuille`,
//   `Immobilier`) are navigable, and `Paramètres` opens in one tap from the
//   Cap header.
import { pekuloColors, useThemeSetting } from "@pekulo/ui";
import { NativeTabs } from "expo-router/native-tabs";

export default function TabsLayout() {
  // TR-strict chrome: grayscale only, driven by the Pekulo tokens so the glass
  // bar keeps ≥ 4.5:1 contrast in both themes.
  const { resolvedTheme } = useThemeSetting();
  const palette = resolvedTheme === "pekulo-light" ? pekuloColors.light : pekuloColors.dark;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={palette.text.primary}
      iconColor={palette.text.secondary}
      labelStyle={{ color: palette.text.secondary }}
    >
      {/* Icon-only bar: labels stay for VoiceOver but are visually hidden.
          Outline at rest, filled when selected. */}
      <NativeTabs.Trigger name="(cap)" accessibilityLabel="Cap" testID="tab-cap">
        <NativeTabs.Trigger.Icon
          sf={{ default: "location.north.circle", selected: "location.north.circle.fill" }}
          md="explore"
        />
        <NativeTabs.Trigger.Label hidden>Cap</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="transactions"
        accessibilityLabel="Transactions"
        testID="tab-transactions"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "creditcard", selected: "creditcard.fill" }}
          md="credit_card"
        />
        <NativeTabs.Trigger.Label hidden>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mensuel" accessibilityLabel="Mensuel" testID="tab-mensuel">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
        />
        <NativeTabs.Trigger.Label hidden>Mensuel</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="portefeuille"
        accessibilityLabel="Portefeuille"
        testID="tab-portefeuille"
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.pie", selected: "chart.pie.fill" }}
          md="pie_chart"
        />
        <NativeTabs.Trigger.Label hidden>Portefeuille</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="immobilier" accessibilityLabel="Immobilier" testID="tab-immobilier">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label hidden>Immobilier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
