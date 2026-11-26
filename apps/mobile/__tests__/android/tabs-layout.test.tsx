// apps/mobile/__tests__/android/tabs-layout.test.tsx
// Story 10-6 AC-5 — the Android tab bar shows all five labels on a grayscale
// Pekulo bar (Material bottom navigation hides unselected labels past three
// items by default).
//
// AC-5 (verbatim from story 10-6-android-parity-and-maestro):
//   Given any system symbol icon in the mobile app, When it renders on Android,
//   Then it shows a Material Symbol, never a blank or text fallback; And the
//   mobile test suite fails when a new symbol icon has no Android name; And the
//   Android tab bar shows all five labels on a grayscale Pekulo bar.
const mockTabsProps: { current?: Record<string, unknown> } = {};

jest.mock("expo-router/native-tabs", () => {
  const { createElement, Fragment } = require("react");
  const { Text } = require("react-native");
  function NativeTabs({ children, ...props }: { children?: unknown }) {
    mockTabsProps.current = props;
    return createElement(Fragment, null, children);
  }
  function Trigger({ children, testID }: { children?: unknown; testID?: string }) {
    return createElement(Fragment, { key: testID }, children);
  }
  Trigger.Icon = function Icon() {
    return null;
  };
  Trigger.Label = function Label({ children }: { children?: unknown }) {
    return createElement(Text, null, children);
  };
  NativeTabs.Trigger = Trigger;
  return { __esModule: true, NativeTabs };
});

import { PekuloRootProvider, pekuloColors } from "@pekulo/ui";
import { render, screen } from "@testing-library/react-native";

import TabsLayout from "../../app/(tabs)/_layout";

describe("Android tab bar (story 10-6, AC-5)", () => {
  it("labels all five tabs on a grayscale Pekulo bar", async () => {
    await render(
      <PekuloRootProvider theme="pekulo-light">
        <TabsLayout />
      </PekuloRootProvider>,
    );
    for (const label of ["Cap", "Transactions", "Mensuel", "Portefeuille", "Immobilier"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const palette = pekuloColors.light;
    expect(mockTabsProps.current).toMatchObject({
      labelVisibilityMode: "labeled",
      backgroundColor: palette.surface.bg,
      indicatorColor: palette.surface.muted,
      rippleColor: palette.surface.muted,
      tintColor: palette.text.primary,
      iconColor: palette.text.secondary,
    });
  });
});
