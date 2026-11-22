import { PekuloRootProvider } from "@pekulo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS } from "react-native";

import NotFoundScreen from "../app/+not-found";
import ImmobilierScreen from "../app/(tabs)/immobilier/index";
import PortefeuilleScreen from "../app/(tabs)/portefeuille/index";
import ParametresScreen from "../app/parametres";
import CompassSheet from "../app/sheets/compass";
import LotSheet from "../app/sheets/lot";
import MortgageSheet from "../app/sheets/mortgage";
import PropertySheet from "../app/sheets/property";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { I18nProvider } from "../lib/i18n";

let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen() {
    return null;
  };
  MockStack.SearchBar = function MockSearchBar() {
    return null;
  };
  function MockToolbar({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockToolbar.Button = function MockToolbarButton({
    children,
    onPress,
    accessibilityLabel,
    variant,
    disabled,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    variant?: string;
    disabled?: boolean;
  }) {
    const RN = require("react-native") as typeof import("react-native");
    return React.createElement(
      RN.Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel,
        disabled,
        onPress,
        testID: variant === "done" ? "sheet-primary-btn" : undefined,
      },
      typeof children === "string" ? React.createElement(RN.Text, null, children) : null,
    );
  };
  MockToolbar.Menu = MockToolbar;
  MockToolbar.MenuAction = MockToolbar.Button;
  MockToolbar.Spacer = function MockSpacer() {
    return null;
  };
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
});

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    compassClient: { getCompass: jest.fn(), updateCompass: jest.fn() },
    llmClient: { getOptIn: jest.fn(), setOptIn: jest.fn() },
    settingsClient: {
      get: jest.fn(),
      updateTheme: jest.fn(),
      updateLang: jest.fn(),
      deleteAccount: jest.fn(),
    },
    holdingsClient: { list: jest.fn(), create: jest.fn(), recordLot: jest.fn(), close: jest.fn() },
    accountsClient: { list: jest.fn() },
    realestateClient: {
      listProperties: jest.fn(),
      listPropertyDerives: jest.fn(),
      getTotalEquity: jest.fn(),
      getProperty: jest.fn(),
      listValuations: jest.fn(),
    },
  };
});

// Preview mode (no session): every screen renders local preview data, so no
// network mocks are needed.
async function renderEnglish(ui: ReactNode) {
  const queryClient = createMobileQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <I18nProvider lang="en">
          <AuthProvider initialSession={null} requireAuth={false}>
            {ui}
          </AuthProvider>
        </I18nProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
}

describe("English UI — Portfolio, Real estate & Settings", () => {
  beforeEach(() => {
    mockParams = {};
    jest.restoreAllMocks();
  });

  it("renders the Portfolio screen and its holding actions in English", async () => {
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation(() => {});
    await renderEnglish(<PortefeuilleScreen />);
    await waitFor(() => expect(screen.getByText("Amundi MSCI World · PEA")).toBeTruthy());
    expect(screen.getByText("Portfolio value")).toBeTruthy();
    expect(screen.getByText("Unrealised gain")).toBeTruthy();
    expect(screen.getByText(/^Allocation$/i)).toBeTruthy();
    expect(screen.getByText(/^Holdings$/i)).toBeTruthy();
    expect(screen.getByText("Stocks")).toBeTruthy();
    expect(screen.queryByText("Valeur portefeuille")).toBeNull();
    expect(screen.queryByText("Plus-value latente")).toBeNull();
    expect(screen.queryByText(/^Répartition$/i)).toBeNull();

    fireEvent.press(screen.getByTestId("holding-row-hld_previewCW8000000000000"));
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ["Record a buy or sell", "Close the holding", "Cancel"],
      }),
      expect.any(Function),
    );
  });

  it("renders the Real estate screen and property card in English", async () => {
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation(() => {});
    await renderEnglish(<ImmobilierScreen />);
    await waitFor(() => expect(screen.getByText("Appartement Lyon 7e")).toBeTruthy());
    expect(screen.getByText("Net equity")).toBeTruthy();
    expect(screen.getByText("Valuation")).toBeTruthy();
    expect(screen.getByText("Remaining debt")).toBeTruthy();
    expect(screen.getByText("VALUATION")).toBeTruthy();
    expect(screen.getByText("NET EQUITY")).toBeTruthy();
    expect(screen.getByText("REMAINING DEBT")).toBeTruthy();
    expect(screen.getByText("MONTHLY PAYMENT · 18 years left")).toBeTruthy();
    expect(screen.getByText("28% repaid")).toBeTruthy();
    expect(screen.queryByText("Équité nette")).toBeNull();
    expect(screen.queryByText("EQUITY")).toBeNull();
    expect(screen.queryByText(/remboursé/)).toBeNull();
    expect(screen.queryByText(/MENSUALITÉ/)).toBeNull();

    fireEvent.press(screen.getByTestId("property-card-res_previewLyon7e0000000"));
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          "Update valuation",
          "Valuation history",
          "Mortgage",
          "Rent",
          "Delete property",
          "Cancel",
        ],
      }),
      expect.any(Function),
    );
  });

  it("renders the Settings screen in English", async () => {
    await renderEnglish(<ParametresScreen />);
    await waitFor(() => expect(screen.getByText("Goal 800 k€")).toBeTruthy());
    expect(screen.getByText("Horizon 30 years")).toBeTruthy();
    expect(screen.getByText("Preview mode")).toBeTruthy();
    expect(screen.getByText("Local offline session")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText(/^Account$/i)).toBeTruthy();
    expect(screen.getByText(/^Appearance$/i)).toBeTruthy();
    expect(screen.getByText("THEME")).toBeTruthy();
    expect(screen.getByText("LANGUAGE")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("French")).toBeTruthy();
    expect(screen.getByText(/^Artificial intelligence$/i)).toBeTruthy();
    expect(screen.getByText("Third-party AI models")).toBeTruthy();
    expect(screen.getByLabelText("Close settings")).toBeTruthy();
    expect(screen.getByLabelText("Edit my Cap")).toBeTruthy();
    for (const fr of [
      "Mode aperçu",
      "Session locale hors connexion",
      "Se connecter",
      "THÈME",
      "LANGUE",
      "Système",
      "Sombre",
      "Clair",
      "Français",
      "Modèles IA tiers",
    ]) {
      expect(screen.queryByText(fr)).toBeNull();
    }
  });

  it("renders the property sheet in English", async () => {
    await renderEnglish(<PropertySheet />);
    expect(screen.getByText("Property name")).toBeTruthy();
    expect(screen.getByText("Estimated value")).toBeTruthy();
    expect(screen.getByText("Valued on")).toBeTruthy();
    expect(screen.getByText("You can add the mortgage and rent afterwards.")).toBeTruthy();
    expect(screen.queryByText("Nom du bien")).toBeNull();
    expect(screen.queryByText("Valeur estimée")).toBeNull();
  });

  it("renders the lot sheet in English", async () => {
    await renderEnglish(<LotSheet />);
    expect(screen.getByText("Buy")).toBeTruthy();
    expect(screen.getByText("Sell")).toBeTruthy();
    expect(screen.getByText("Unit price")).toBeTruthy();
    expect(screen.getByText("Fees")).toBeTruthy();
    expect(screen.queryByText("Achat")).toBeNull();
    expect(screen.queryByText("Prix unitaire")).toBeNull();
  });

  it("renders the mortgage sheet in English", async () => {
    mockParams = { id: "res_previewLyon7e0000000" };
    await renderEnglish(<MortgageSheet />);
    expect(screen.getByText("Outstanding principal")).toBeTruthy();
    expect(screen.getByText("Annual rate")).toBeTruthy();
    expect(screen.getByText("months")).toBeTruthy();
    expect(screen.queryByText("Capital restant dû")).toBeNull();
    expect(screen.queryByText("mois")).toBeNull();
  });

  it("renders the compass sheet in English", async () => {
    await renderEnglish(<CompassSheet />);
    expect(screen.getByText("Goal")).toBeTruthy();
    expect(screen.getByText("years")).toBeTruthy();
    expect(
      screen.getByText(/Your Cap is the net worth you aim for at the chosen horizon/),
    ).toBeTruthy();
    expect(screen.queryByText("Objectif")).toBeNull();
  });

  it("renders the not-found screen in English", async () => {
    await renderEnglish(<NotFoundScreen />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(screen.getByText("Back to Cap")).toBeTruthy();
    expect(screen.queryByText("Page introuvable")).toBeNull();
  });
});
