import { PekuloRootProvider } from "@pekulo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import CapScreen from "../app/(tabs)/(cap)/index";
import LoginScreen from "../app/login";
import AccountSheet from "../app/sheets/account";
import AccountBalanceSheet from "../app/sheets/account-balance";
import MilestoneSheet from "../app/sheets/milestone";
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

// Render header buttons so the sheets' native Save / + actions are visible.
jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen({
    options,
  }: {
    options?: { headerRight?: () => React.ReactNode; headerLeft?: () => React.ReactNode };
  }) {
    return React.createElement(
      React.Fragment,
      null,
      options?.headerLeft?.(),
      options?.headerRight?.(),
    );
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
    dashboardClient: { getOverview: jest.fn() },
    compassClient: { getCompass: jest.fn() },
    milestonesClient: {
      list: jest.fn(),
      getStatuses: jest.fn(),
      add: jest.fn(),
      delete: jest.fn(),
    },
    accountsClient: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      recordBalanceChange: jest.fn(),
      delete: jest.fn(),
    },
  };
});

// Preview mode (no session): the screens render local preview data, so no
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

describe("English UI — Cap & Patrimoine", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("renders the Cap view in English", async () => {
    await renderEnglish(<CapScreen />);
    await waitFor(() => expect(screen.getByText("Total wealth")).toBeTruthy());
    expect(screen.getByText("Cap")).toBeTruthy();
    expect(screen.getByText("Net worth")).toBeTruthy();
    expect(screen.getByText("vs plan · 12 months")).toBeTruthy();
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("Next milestone")).toBeTruthy();
    expect(screen.getByText("Milestones")).toBeTruthy();
    expect(screen.getByText("ahead")).toBeTruthy();
    expect(screen.getByText("Recent activity")).toBeTruthy();
    expect(screen.getByLabelText("Delete milestone Palier 100 k€")).toBeTruthy();

    expect(screen.queryByText("Patrimoine total")).toBeNull();
    expect(screen.queryByText("Patrimoine")).toBeNull();
    expect(screen.queryByText("Avancement")).toBeNull();
    expect(screen.queryByText("Prochain palier")).toBeNull();
    expect(screen.queryByText("Paliers")).toBeNull();
    expect(screen.queryByText("en avance")).toBeNull();
  });

  it("renders the Net worth view in English", async () => {
    await renderEnglish(<CapScreen />);
    await fireEvent.press(screen.getByText("Net worth"));
    await waitFor(() => expect(screen.getByText("Accounts")).toBeTruthy());
    expect(screen.getByText("Savings account")).toBeTruthy();
    expect(screen.getByText("Net equity")).toBeTruthy();
    expect(screen.queryByText("Comptes")).toBeNull();
    expect(screen.queryByText("Livret")).toBeNull();
  });

  it("renders the milestone sheet in English", async () => {
    await renderEnglish(<MilestoneSheet />);
    expect(screen.getByText("Target capital")).toBeTruthy();
    expect(screen.getByText("Year")).toBeTruthy();
    expect(screen.getByText("Name (optional)")).toBeTruthy();
    expect(screen.queryByText("Capital visé")).toBeNull();
    expect(screen.queryByText("Année")).toBeNull();
  });

  it("renders the account sheets in English", async () => {
    const created = await renderEnglish(<AccountSheet />);
    expect(screen.getByText("Account name")).toBeTruthy();
    expect(screen.getByText("Current balance")).toBeTruthy();
    expect(screen.getByText("Accounts are held in euros.")).toBeTruthy();
    expect(screen.queryByText("Nom du compte")).toBeNull();
    await created.unmount();

    mockParams = { id: "acc_previewLivretA000000" };
    await renderEnglish(<AccountBalanceSheet />);
    await waitFor(() => expect(screen.getByText("New balance")).toBeTruthy());
    expect(screen.getByText("The new balance is added to the account history.")).toBeTruthy();
    expect(screen.queryByText("Nouveau solde")).toBeNull();
  });
});

describe("English UI — Login", () => {
  it("renders the sign-in screen and its validation errors in English", async () => {
    await renderEnglish(<LoginScreen />);
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Continue in preview mode")).toBeTruthy();
    expect(screen.queryByText("Connexion")).toBeNull();
    expect(screen.queryByText("Se connecter")).toBeNull();
    expect(screen.queryByText("Mot de passe")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("login-email-input"), "not-an-email");
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "super-secret-password-2026",
    );
    await fireEvent.press(screen.getByTestId("login-submit-btn"));
    await waitFor(() =>
      expect(screen.getByText("Please enter a valid email address.")).toBeTruthy(),
    );
    expect(screen.queryByText("Veuillez saisir une adresse e-mail valide.")).toBeNull();
  });
});
