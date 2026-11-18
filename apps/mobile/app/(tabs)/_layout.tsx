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
      <NativeTabs.Trigger name="(cap)">
        <NativeTabs.Trigger.Icon sf={{ default: "safari", selected: "safari.fill" }} md="explore" />
        <NativeTabs.Trigger.Label>Cap</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon sf="arrow.up.arrow.down" md="swap_vert" />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mensuel">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Mensuel</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portefeuille">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
          md="show_chart"
        />
        <NativeTabs.Trigger.Label>Portefeuille</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="immobilier">
        <NativeTabs.Trigger.Icon
          sf={{ default: "building.2", selected: "building.2.fill" }}
          md="apartment"
        />
        <NativeTabs.Trigger.Label>Immobilier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
