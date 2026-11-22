// English rendering of the Transactions, Mensuel and transaction-sheet screens.
// Preview mode (no session) serves local data, so no network mocks are needed.
import { PekuloRootProvider } from "@pekulo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import MensuelScreen from "../app/(tabs)/mensuel/index";
import TransactionsScreen from "../app/(tabs)/transactions/index";
import TransactionSheet from "../app/sheets/transaction";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { currentMonthKey, formatMonthKey } from "../lib/forms";
import { I18nProvider, type Lang } from "../lib/i18n";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

// Render header / toolbar buttons so their labels are queryable.
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

async function renderPreview(ui: ReactNode, lang: Lang = "en") {
  const queryClient = createMobileQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <I18nProvider lang={lang}>
          <AuthProvider initialSession={null} requireAuth={false}>
            {ui}
          </AuthProvider>
        </I18nProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
}

function utcMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("i18n — Transactions in English", () => {
  it("renders the month navigator, summary and list in English", async () => {
    await renderPreview(<TransactionsScreen />);

    expect(await screen.findByText("Recent")).toBeTruthy();
    expect(screen.getByTestId("month-label")).toHaveTextContent(
      formatMonthKey(currentMonthKey(), "en-GB"),
    );
    expect(screen.getByText("Net this month")).toBeTruthy();
    expect(screen.getByText("Inflows")).toBeTruthy();
    expect(screen.getByText("Outflows")).toBeTruthy();
    expect(screen.getByLabelText("Previous month")).toBeTruthy();
    expect(screen.getByLabelText("Next month")).toBeTruthy();
    expect(screen.getByLabelText("Recent transactions")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search transactions")).toBeTruthy();

    expect(screen.queryByText("Récentes")).toBeNull();
    expect(screen.queryByText("Solde du mois")).toBeNull();
    expect(screen.queryByText("Entrées")).toBeNull();
    expect(screen.queryByPlaceholderText("Rechercher une transaction")).toBeNull();
    expect(screen.queryByLabelText("Mois précédent")).toBeNull();
  });

  it("pluralises the result counter and shows the English empty search state", async () => {
    await renderPreview(<TransactionsScreen />);
    await screen.findByText("Recent");

    await fireEvent.changeText(screen.getByTestId("tx-search"), "zzz-no-match");

    expect(screen.getByText("0 results")).toBeTruthy();
    expect(screen.getByText("No results")).toBeTruthy();
    expect(screen.getByText("No transaction matches “zzz-no-match”.")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByLabelText("Cancel search")).toBeTruthy();
    expect(screen.queryByText("Annuler")).toBeNull();
    expect(screen.queryByText("Aucun résultat")).toBeNull();
  });

  it("keeps the French singular for zero results", async () => {
    await renderPreview(<TransactionsScreen />, "fr");
    await screen.findByText("Récentes");

    await fireEvent.changeText(screen.getByTestId("tx-search"), "zzz-no-match");

    expect(screen.getByText("0 résultat")).toBeTruthy();
    expect(screen.getByText("Annuler")).toBeTruthy();
  });
});

describe("i18n — Mensuel in English", () => {
  it("renders stats, close button and history in English", async () => {
    await renderPreview(<MensuelScreen />);

    // Wait for the preview data (the closed April row) rather than the fallback.
    expect(await screen.findByText("Closed")).toBeTruthy();
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Net savings")).toBeTruthy();
    expect(screen.getByText("Income")).toBeTruthy();
    expect(screen.getByText("Spending")).toBeTruthy();
    expect(screen.getByLabelText("Monthly history")).toBeTruthy();

    // English keeps the month name capitalised mid-sentence.
    const month = formatMonthKey(utcMonthKey(), "en-GB");
    expect(screen.getByText(`Close ${month}`)).toBeTruthy();
    expect(screen.getByLabelText(`Close ${month}`)).toBeTruthy();

    expect(screen.queryByText("Historique")).toBeNull();
    expect(screen.queryByText("Épargne nette")).toBeNull();
    expect(screen.queryByText("Clôturé")).toBeNull();
    expect(screen.queryByText(/^Clôtur/)).toBeNull();
  });
});

describe("i18n — Transaction sheet in English", () => {
  it("renders the form labels and primary action in English", async () => {
    await renderPreview(<TransactionSheet />);

    expect(await screen.findByText("Label")).toBeTruthy();
    expect(screen.getByText("Amount")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Unexpected")).toBeTruthy();
    expect(screen.getByText("Outflow")).toBeTruthy();
    expect(screen.getByText("Inflow")).toBeTruthy();
    expect(screen.getByText("Notes (optional)")).toBeTruthy();
    expect(screen.getByPlaceholderText("Groceries, salary…")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();

    expect(screen.queryByText("Libellé")).toBeNull();
    expect(screen.queryByText("Montant")).toBeNull();
    expect(screen.queryByText("Sortie")).toBeNull();
    expect(screen.queryByText("Notes (facultatif)")).toBeNull();
    expect(screen.queryByText("Ajouter")).toBeNull();
  });
});
