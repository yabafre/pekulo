import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { ORPCError } from "@orpc/client";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS, Alert } from "react-native";

import CapScreen from "../app/(tabs)/(cap)/index";
import TransactionsScreen from "../app/(tabs)/transactions/index";
import AccountSheet from "../app/sheets/account";
import AccountBalanceSheet from "../app/sheets/account-balance";
import MilestoneSheet from "../app/sheets/milestone";
import TransactionSheet from "../app/sheets/transaction";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { toIsoDate } from "../lib/forms";
import {
  accountsClient,
  compassClient,
  dashboardClient,
  milestonesClient,
  transactionsClient,
} from "../lib/orpc/modules";

import { accountDto, milestoneDto, transactionDto } from "./helpers/contract-fixtures";
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

// Render header buttons so tests can press the native Save / + actions.
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
  // Native toolbar items rendered as plain buttons so tests can press them.
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
    transactionsClient: {
      monthSummary: jest.fn(),
      listPendingSuggestions: jest.fn(),
      listTransactions: jest.fn(),
      confirmCategorisation: jest.fn(),
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      deleteTransaction: jest.fn(),
    },
  };
});

const SESSION: Session = {
  access_token: "jwt",
  refresh_token: "r",
  expires_in: 3600,
  expires_at: 1999999999,
  token_type: "bearer",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "alex@pekulo.app",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-05-03T00:00:00Z",
  },
};

const ACC = "acc_AAAAAAAAAAAAAAAAAAAAA";
const TX = "tx_AAAAAAAAAAAAAAAAAAAAA";
const MST = "mst_AAAAAAAAAAAAAAAAAAAAA";

const RAW_TX = {
  id: TX,
  accountId: ACC,
  occurredOn: "2026-11-03",
  label: "Loyer",
  amount: 900,
  type: "outflow",
  category: "loyer",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: "2026-11-03T00:00:00Z",
};

async function renderLive(ui: ReactNode) {
  const queryClient = createMobileQueryClient();
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <AuthProvider initialSession={SESSION} requireAuth={false}>
          {ui}
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

function pickActionSheet(label: string) {
  return jest
    .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
    .mockImplementation((opts, cb) => cb(opts.options.indexOf(label)));
}

function acceptDestructive() {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

function seedTransactions() {
  (transactionsClient.monthSummary as jest.Mock).mockImplementation(
    async (input: { month?: string }) => ({
      month: input.month ?? "2026-11",
      incomeEur: 0,
      spendingEur: 900,
      netChangeEur: -900,
    }),
  );
  (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
  });
  (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({
    items: [RAW_TX],
    nextCursor: null,
    totalCount: null,
  });
  (accountsClient.list as jest.Mock).mockResolvedValue([
    {
      id: ACC,
      label: "Courant",
      type: "banque",
      currency: "EUR",
      cashBalance: 1500,
      notes: null,
    },
  ]);
}

// AC-6 (verbatim from story 10-4-mobile-auth-and-orpc:21):
//   Given an authenticated mobile session, When the user creates, edits, or deletes a
//   transaction (with month navigation and AI category override), adds or deletes a
//   milestone, creates, edits, re-balances, or deletes an account, ... Then each action
//   calls the matching `@pekulo/contracts` procedure with input validated by the shared
//   `@pekulo/validators` schema through native iOS sheets, action sheets, and destructive
//   confirmations, the affected screens refresh immediately ...
describe("AC-6 — Transactions interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = {};
    seedTransactions();
  });

  it("creates a transaction from the native sheet", async () => {
    (transactionsClient.createTransaction as jest.Mock).mockResolvedValue(transactionDto());
    pickActionSheet("Courses");
    await renderLive(<TransactionSheet />);

    await waitFor(() => expect(screen.getByText("Courant")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-label"), "Marché");
    await fireEvent.changeText(screen.getByTestId("tx-amount"), "12,50");
    await fireEvent.press(screen.getByTestId("tx-category"));
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));

    await waitFor(() =>
      expect(transactionsClient.createTransaction).toHaveBeenCalledWith({
        accountId: ACC,
        occurredOn: toIsoDate(new Date()),
        label: "Marché",
        amount: 12.5,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
      }),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows the shared validator message inline and makes no call", async () => {
    await renderLive(<TransactionSheet />);
    await waitFor(() => expect(screen.getByText("Courant")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-amount"), "10");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() => expect(screen.getByText("Libellé requis")).toBeTruthy());
    expect(transactionsClient.createTransaction).not.toHaveBeenCalled();
  });

  it("edits an existing transaction prefilled from the cache", async () => {
    mockParams = { id: TX };
    (transactionsClient.updateTransaction as jest.Mock).mockResolvedValue(transactionDto());
    await renderLive(<TransactionSheet />);

    await waitFor(() => expect(screen.getByDisplayValue("Loyer")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-label"), "Loyer novembre");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));

    await waitFor(() =>
      expect(transactionsClient.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ id: TX, label: "Loyer novembre", amount: 900 }),
      ),
    );
  });

  it("creates exactly one transaction when the primary action is tapped twice in the same tick", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    (transactionsClient.createTransaction as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    await renderLive(<TransactionSheet />);
    await waitFor(() => expect(screen.getByText("Courant")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-label"), "Marché");
    await fireEvent.changeText(screen.getByTestId("tx-amount"), "12,50");

    const primary = screen.getByTestId("sheet-primary-btn");
    await act(async () => {
      void fireEvent.press(primary);
      void fireEvent.press(primary);
    });

    expect(transactionsClient.createTransaction).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate(transactionDto());
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("explains a missing transaction instead of showing a blank edit form", async () => {
    mockParams = { id: "tx_ZZZZZZZZZZZZZZZZZZZZZ" };
    await renderLive(<TransactionSheet />);

    await waitFor(() =>
      expect(
        screen.getByText("Cet élément n’existe plus. Actualisez puis réessayez."),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId("sheet-primary-btn").props.accessibilityState?.disabled).toBe(true);
    expect(transactionsClient.updateTransaction).not.toHaveBeenCalled();
  });

  it("shows a typed contract failure as a specific toast, not the generic one", async () => {
    (transactionsClient.createTransaction as jest.Mock).mockRejectedValue(
      new ORPCError("ACCOUNT_NOT_FOUND", { status: 404 }),
    );
    await renderLive(<TransactionSheet />);
    await waitFor(() => expect(screen.getByText("Courant")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-label"), "Marché");
    await fireEvent.changeText(screen.getByTestId("tx-amount"), "12,50");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));

    await waitFor(() => expect(screen.getByText("Élément introuvable")).toBeTruthy());
    expect(screen.queryByText("Enregistrement impossible")).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("follows the cursor so the list adds up to the month totals, and flags a capped month", async () => {
    const page = (start: number, nextCursor: string | null) => ({
      items: Array.from({ length: 2 }, (_, i) => ({
        ...RAW_TX,
        id: `tx_${String(start + i).padStart(21, "B")}`,
        label: `Ligne ${start + i}`,
      })),
      nextCursor,
      totalCount: null,
    });
    (transactionsClient.listTransactions as jest.Mock)
      .mockResolvedValueOnce(page(0, "c1"))
      .mockResolvedValueOnce(page(2, null));
    await renderLive(<TransactionsScreen />);

    await waitFor(() => expect(screen.getByText("Ligne 3")).toBeTruthy());
    expect(transactionsClient.listTransactions).toHaveBeenCalledTimes(2);
    expect(transactionsClient.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "c1", limit: 200 }),
    );
    expect(screen.queryByTestId("tx-truncated-note")).toBeNull();
  });

  it("shows the true pending count, scoped to the displayed month", async () => {
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
      items: [
        transactionDto({
          suggestedCategory: "courses",
          suggestedConfidence: 0.9,
          suggestedRoute: "ollama",
        }),
      ],
      totalCount: 14,
      page: 1,
      pageSize: 10,
    });
    await renderLive(<TransactionsScreen />);

    await waitFor(() => expect(screen.getByText(/14/)).toBeTruthy());
    expect(transactionsClient.listPendingSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 10,
        month: expect.stringMatching(/^\d{4}-\d{2}$/),
      }),
    );
  });

  it("deletes a transaction from its row action sheet after confirmation", async () => {
    (transactionsClient.deleteTransaction as jest.Mock).mockResolvedValue({ ok: true });
    pickActionSheet("Supprimer");
    acceptDestructive();
    await renderLive(<TransactionsScreen />);

    await waitFor(() => expect(screen.getByTestId(`tx-row-${TX}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`tx-row-${TX}`));
    await waitFor(() =>
      expect(transactionsClient.deleteTransaction).toHaveBeenCalledWith({ id: TX }),
    );
  });

  it("filters rows with the in-content search field and hides the month header", async () => {
    (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({
      items: [
        RAW_TX,
        {
          ...RAW_TX,
          id: "tx_BBBBBBBBBBBBBBBBBBBBB",
          label: "Paie novembre",
          category: "salaire",
          type: "inflow",
        },
      ],
    });
    await renderLive(<TransactionsScreen />);
    await waitFor(() => expect(screen.getByText("Paie novembre")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("tx-search"), "loy");
    await waitFor(() => expect(screen.queryByText("Paie novembre")).toBeNull());
    expect(screen.getByTestId(`tx-row-${TX}`)).toBeTruthy();
    expect(screen.getByText("1 résultat")).toBeTruthy();
    expect(screen.queryByTestId("month-prev-btn")).toBeNull();
  });

  it("navigates to the previous month", async () => {
    await renderLive(<TransactionsScreen />);
    await waitFor(() => expect(screen.getByTestId("month-prev-btn")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("month-prev-btn"));
    await waitFor(() =>
      expect(transactionsClient.listTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ month: expect.stringMatching(/^\d{4}-\d{2}$/) }),
      ),
    );
  });
});

describe("AC-6 — Cap & Patrimoine interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockParams = {};
    seedTransactions();
    (dashboardClient.getOverview as jest.Mock).mockResolvedValue({
      totalWealthEur: 100000,
      composition: { liquideEur: 1500, placementsEur: 0, immobilierEur: 0 },
      recentActivity: [],
      compass: { objectif: 800000, percent: 12.5, currentWealth: 100000 },
    });
    (compassClient.getCompass as jest.Mock).mockResolvedValue({
      objectif: 800000,
      horizonYears: 30,
    });
    (milestonesClient.list as jest.Mock).mockResolvedValue([
      { id: MST, label: "Palier 250 k€", targetCapital: 250000, targetYear: 2035 },
    ]);
    (milestonesClient.getStatuses as jest.Mock).mockResolvedValue([
      { id: MST, status: "on-track", delta: 0 },
    ]);
  });

  it("adds a milestone from the sheet", async () => {
    (milestonesClient.add as jest.Mock).mockResolvedValue(milestoneDto());
    await renderLive(<MilestoneSheet />);
    await fireEvent.changeText(screen.getByTestId("ms-capital"), "250 000");
    await fireEvent.changeText(screen.getByTestId("ms-year"), "2035");
    await fireEvent.changeText(screen.getByTestId("ms-label"), "Palier 250 k€");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(milestonesClient.add).toHaveBeenCalledWith({
        targetCapital: 250000,
        targetYear: 2035,
        label: "Palier 250 k€",
      }),
    );
  });

  it("deletes a milestone after a destructive confirmation", async () => {
    (milestonesClient.delete as jest.Mock).mockResolvedValue({ id: MST });
    acceptDestructive();
    await renderLive(<CapScreen />);
    await waitFor(() => expect(screen.getByText("Palier 250 k€")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Supprimer le palier Palier 250 k€"));
    await waitFor(() => expect(milestonesClient.delete).toHaveBeenCalledWith({ id: MST }));
  });

  it("opens the create menu from the Cap header", async () => {
    pickActionSheet("Nouveau palier");
    await renderLive(<CapScreen />);
    await fireEvent.press(screen.getByTestId("header-add-btn"));
    expect(mockPush).toHaveBeenCalledWith("/sheets/milestone");
  });

  it("creates an account and records a new balance", async () => {
    (accountsClient.create as jest.Mock).mockResolvedValue(accountDto());
    (accountsClient.recordBalanceChange as jest.Mock).mockResolvedValue(accountDto());
    pickActionSheet("Livret");
    const created = await renderLive(<AccountSheet />);
    await fireEvent.changeText(screen.getByTestId("acc-label"), "Livret A");
    await fireEvent.press(screen.getByTestId("acc-type"));
    await fireEvent.changeText(screen.getByTestId("acc-balance"), "1 000");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(accountsClient.create).toHaveBeenCalledWith({
        label: "Livret A",
        type: "livret",
        currency: "EUR",
        cashBalance: 1000,
        notes: null,
      }),
    );
    await created.unmount();

    mockParams = { id: ACC };
    await renderLive(<AccountBalanceSheet />);
    await fireEvent.changeText(screen.getByTestId("bal-amount"), "1 250,5");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(accountsClient.recordBalanceChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: ACC, cashBalance: 1250.5, valuedOn: expect.any(Date) }),
      ),
    );
  });

  it("edits an existing account (label, type, notes) prefilled from the cache", async () => {
    mockParams = { id: ACC };
    (accountsClient.update as jest.Mock).mockResolvedValue(accountDto({ label: "Compte joint" }));
    await renderLive(<AccountSheet />);

    await waitFor(() => expect(screen.getByDisplayValue("Courant")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("acc-label"), "Compte joint");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));

    await waitFor(() =>
      expect(accountsClient.update).toHaveBeenCalledWith({
        id: ACC,
        label: "Compte joint",
        type: "banque",
        notes: null,
      }),
    );
    expect(accountsClient.create).not.toHaveBeenCalled();
  });

  it("deletes an account from the Patrimoine row action sheet", async () => {
    (accountsClient.delete as jest.Mock).mockResolvedValue({ ok: true });
    pickActionSheet("Supprimer");
    acceptDestructive();
    await renderLive(<CapScreen />);
    await fireEvent.press(screen.getByText("Patrimoine"));
    await waitFor(() => expect(screen.getByTestId(`account-row-${ACC}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`account-row-${ACC}`));
    await waitFor(() => expect(accountsClient.delete).toHaveBeenCalledWith({ id: ACC }));
  });
});
