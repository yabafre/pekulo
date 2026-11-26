// apps/mobile/__tests__/android/headers.test.tsx
// Story 10-6 AC-2 — Android header surfaces never reach Stack.Toolbar.
//
// AC-2 (verbatim from story 10-6-android-parity-and-maestro):
//   Given the app running on Android, When any primary tab, Paramètres, or any
//   form sheet renders, Then no iOS-only toolbar item is rendered (they crash on
//   Android without the optional Expo UI module); the four tabs with header
//   actions show their create (+) and profile buttons in the native header, on an
//   opaque Pekulo-coloured header that never overlaps the content; every form
//   sheet shows an in-content header row (Annuler/Fermer · title · primary action)
//   and its primary action submits the form; Paramètres shows its own title and
//   closes with the system back action; And iOS headers and toolbar items are
//   unchanged.
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: mockReplace,
      canGoBack: () => true,
    }),
  };
});

jest.mock("expo-router/stack", () =>
  require("./helpers/android-stack-mock").createAndroidStackMock(),
);

import { PekuloRootProvider, pekuloColors } from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { SheetScaffold } from "../../components/form/sheet";
import { TabStackLayout, TabToolbar } from "../../components/tab-stack-layout";
import { recordedStack } from "./helpers/android-stack-mock";

async function renderThemed(ui: ReactNode) {
  return await render(<PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>);
}

describe("Android headers (story 10-6, AC-2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("TabToolbar puts + and profile in the native header without Stack.Toolbar", async () => {
    const onAdd = jest.fn();
    await renderThemed(<TabToolbar onAdd={onAdd} addLabel="Nouvelle transaction" />);
    expect(screen.getByTestId("mock-native-header-right")).toBeTruthy();
    expect(screen.getByLabelText("Nouvelle transaction")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("header-add-btn"));
    expect(onAdd).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("header-settings-btn"));
    expect(mockPush).toHaveBeenCalledWith("/parametres");
  });

  it("tab headers are opaque and Pekulo-coloured so they never overlap the content", async () => {
    await renderThemed(<TabStackLayout titleKey="common.tabs.transactions" />);
    const palette = pekuloColors.light;
    const options = recordedStack.screenOptions ?? {};
    // A transparent header overlaps the content on Android (no automatic insets).
    expect(options.headerTransparent).toBeUndefined();
    expect(options.headerLargeTitle).toBeUndefined();
    expect(options).toMatchObject({
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.surface.bg },
      headerTitleStyle: { color: palette.text.primary },
      headerTintColor: palette.text.primary,
      contentStyle: { backgroundColor: palette.surface.bg },
    });
  });

  it("TabToolbar without onAdd renders only the profile button", async () => {
    await renderThemed(<TabToolbar />);
    expect(screen.queryByTestId("header-add-btn")).toBeNull();
    expect(screen.getByTestId("header-settings-btn")).toBeTruthy();
  });

  it("SheetScaffold renders an in-content header whose primary action submits", async () => {
    const onPrimary = jest.fn();
    await renderThemed(
      <SheetScaffold title="Nouvelle valorisation" onPrimary={onPrimary}>
        <Text>Corps du formulaire</Text>
      </SheetScaffold>,
    );
    expect(screen.getByText("Nouvelle valorisation")).toBeTruthy();
    expect(screen.getByText("Corps du formulaire")).toBeTruthy();
    expect(screen.getByText("Annuler")).toBeTruthy();
    expect(screen.getByText("Enregistrer")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("sheet-dismiss-btn"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("SheetScaffold ignores the primary action while it is disabled", async () => {
    const onPrimary = jest.fn();
    await renderThemed(
      <SheetScaffold title="Compte" onPrimary={onPrimary} primaryDisabled>
        <Text>Corps</Text>
      </SheetScaffold>,
    );
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it("SheetScaffold without a primary action shows Fermer only", async () => {
    await renderThemed(
      <SheetScaffold title="Historique">
        <Text>Corps</Text>
      </SheetScaffold>,
    );
    expect(screen.getByText("Fermer")).toBeTruthy();
    expect(screen.queryByTestId("sheet-primary-btn")).toBeNull();
  });
});
