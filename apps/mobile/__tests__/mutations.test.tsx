import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { isWithinCloseWindow, parseAmountInput, shiftMonthKey, toIsoDate } from "../lib/forms";
import {
  PreviewModeError,
  useAccountMutations,
  useCompassMutation,
  useDeleteUserAccount,
  useHoldingMutations,
  useLlmOptIn,
  useMilestoneMutations,
  useMonthlyMutations,
  useRealEstateMutations,
  useTransactionMutations,
} from "../lib/hooks/use-mobile-mutations";
import {
  accountsClient,
  compassClient,
  holdingsClient,
  llmClient,
  milestonesClient,
  monthlyClient,
  realestateClient,
  settingsClient,
  transactionsClient,
} from "../lib/orpc/modules";
import {
  useMobileCompassData,
  useMobileMonthlyData,
  useMobilePropertyDetail,
  useMobileTransactionsData,
  useMobileValuations,
} from "../lib/hooks/use-mobile-queries";
import { supabase } from "../lib/supabase/client";

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    transactionsClient: {
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      deleteTransaction: jest.fn(),
      confirmCategorisation: jest.fn(),
      monthSummary: jest.fn(),
      listPendingSuggestions: jest.fn(),
      listTransactions: jest.fn(),
    },
    milestonesClient: { add: jest.fn(), delete: jest.fn() },
    accountsClient: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      recordBalanceChange: jest.fn(),
      delete: jest.fn(),
    },
    holdingsClient: { create: jest.fn(), recordLot: jest.fn(), close: jest.fn() },
    realestateClient: {
      createProperty: jest.fn(),
      recordValuation: jest.fn(),
      attachMortgage: jest.fn(),
      updateMortgage: jest.fn(),
      attachRental: jest.fn(),
      updateRental: jest.fn(),
      deleteProperty: jest.fn(),
      getProperty: jest.fn(),
      listValuations: jest.fn(),
    },
    monthlyClient: {
      signOffMonthly: jest.fn(),
      reopenMonthly: jest.fn(),
      listMonthly: jest.fn(),
      getMonthly: jest.fn(),
    },
    compassClient: { updateCompass: jest.fn(), getCompass: jest.fn() },
    llmClient: { getOptIn: jest.fn(), setOptIn: jest.fn() },
    settingsClient: { deleteAccount: jest.fn() },
  };
});

const SESSION: Session = {
  access_token: "jwt-mobile-mutations",
  refresh_token: "refresh",
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
const HLD = "hld_AAAAAAAAAAAAAAAAAAAAA";
const RE = "res_AAAAAAAAAAAAAAAAAAAAA";

function wrapperFor(session: Session | null) {
  const queryClient = createMobileQueryClient();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider theme="pekulo-dark">
          <AuthProvider initialSession={session} requireAuth={false}>
            {children}
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient, invalidate };
}

function invalidatedKeys(invalidate: jest.SpyInstance) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: string[] }).queryKey[1]);
}

// AC-6 (verbatim from story 10-4-mobile-auth-and-orpc:21):
//   Given an authenticated mobile session, When the user creates, edits, or deletes a
//   transaction (with month navigation and AI category override), adds or deletes a
//   milestone, creates, edits, re-balances, or deletes an account, adds a holding, records
//   a lot, or closes a holding, creates a property, records a valuation, views the
//   valuation history, attaches or updates a mortgage or a rental, or deletes a property,
//   signs off the current month inside its close window or reopens a signed-off month,
//   edits the compass objective and horizon, toggles the third-party AI opt-in, or deletes
//   the account, Then each action calls the matching `@pekulo/contracts` procedure with
//   input validated by the shared `@pekulo/validators` schema through native iOS sheets,
//   action sheets, and destructive confirmations, the affected screens refresh
//   immediately, And in unauthenticated preview mode every mutation is blocked with a
//   sign-in prompt and no remote call.
describe("AC-6 — mobile mutation hooks call the matching contract procedures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transactions: create, update, delete and category override, refreshing transactions, cap and monthly", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    (transactionsClient.createTransaction as jest.Mock).mockResolvedValue({ id: TX });
    (transactionsClient.updateTransaction as jest.Mock).mockResolvedValue({ id: TX });
    (transactionsClient.deleteTransaction as jest.Mock).mockResolvedValue({ ok: true });
    (transactionsClient.confirmCategorisation as jest.Mock).mockResolvedValue({ id: TX });
    const { result } = await renderHook(() => useTransactionMutations(), { wrapper: Wrapper });

    const input = {
      accountId: ACC,
      occurredOn: "2026-11-20",
      label: "Courses",
      amount: 42.5,
      type: "outflow" as const,
      category: "courses" as const,
      isImprevu: false,
      notes: null,
    };
    await act(() => result.current.create.mutateAsync(input));
    await act(() => result.current.update.mutateAsync({ id: TX, label: "Courses bio" }));
    await act(() => result.current.remove.mutateAsync({ id: TX }));
    await act(() => result.current.confirmCategory.mutateAsync({ id: TX, category: "sorties" }));

    expect(transactionsClient.createTransaction).toHaveBeenCalledWith(input);
    expect(transactionsClient.updateTransaction).toHaveBeenCalledWith({
      id: TX,
      label: "Courses bio",
    });
    expect(transactionsClient.deleteTransaction).toHaveBeenCalledWith({ id: TX });
    expect(transactionsClient.confirmCategorisation).toHaveBeenCalledWith({
      id: TX,
      category: "sorties",
    });
    expect(invalidatedKeys(invalidate)).toEqual(
      expect.arrayContaining(["transactions", "cap", "monthly"]),
    );
  });

  it("transactions: rejects schema-invalid input before any remote call", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    const { result } = await renderHook(() => useTransactionMutations(), { wrapper: Wrapper });
    await expect(
      result.current.create.mutateAsync({
        accountId: ACC,
        occurredOn: "2026-11-20",
        label: "",
        amount: 10,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
      }),
    ).rejects.toThrow("Libellé requis");
    expect(transactionsClient.createTransaction).not.toHaveBeenCalled();
  });

  it("milestones: add and delete", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    (milestonesClient.add as jest.Mock).mockResolvedValue({ id: MST });
    (milestonesClient.delete as jest.Mock).mockResolvedValue({ ok: true });
    const { result } = await renderHook(() => useMilestoneMutations(), { wrapper: Wrapper });

    await act(() =>
      result.current.add.mutateAsync({ targetCapital: 250000, targetYear: 2035, label: "250 k" }),
    );
    await act(() => result.current.remove.mutateAsync({ id: MST }));

    expect(milestonesClient.add).toHaveBeenCalledWith({
      targetCapital: 250000,
      targetYear: 2035,
      label: "250 k",
    });
    expect(milestonesClient.delete).toHaveBeenCalledWith({ id: MST });
    expect(invalidatedKeys(invalidate)).toContain("cap");
  });

  it("accounts: create, update, re-balance and delete", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    for (const fn of ["create", "update", "recordBalanceChange", "delete"] as const) {
      (accountsClient[fn] as jest.Mock).mockResolvedValue({ id: ACC });
    }
    const { result } = await renderHook(() => useAccountMutations(), { wrapper: Wrapper });

    await act(() =>
      result.current.create.mutateAsync({
        label: "Livret A",
        type: "livret",
        currency: "EUR",
        cashBalance: 1000,
        notes: null,
      }),
    );
    await act(() => result.current.update.mutateAsync({ id: ACC, label: "Livret A perso" }));
    await act(() =>
      result.current.recordBalance.mutateAsync({
        id: ACC,
        valuedOn: new Date("2026-11-20T00:00:00Z"),
        cashBalance: 1200,
      }),
    );
    await act(() => result.current.remove.mutateAsync({ id: ACC }));

    expect(accountsClient.create).toHaveBeenCalledWith({
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 1000,
      notes: null,
    });
    expect(accountsClient.update).toHaveBeenCalledWith({ id: ACC, label: "Livret A perso" });
    expect(accountsClient.recordBalanceChange).toHaveBeenCalledWith({
      id: ACC,
      valuedOn: new Date("2026-11-20T00:00:00Z"),
      cashBalance: 1200,
    });
    expect(accountsClient.delete).toHaveBeenCalledWith({ id: ACC });
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(["cap", "transactions"]));
  });

  it("holdings: create, record a lot and close", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    (holdingsClient.create as jest.Mock).mockResolvedValue({ id: HLD });
    (holdingsClient.recordLot as jest.Mock).mockResolvedValue({ id: "lot_1" });
    (holdingsClient.close as jest.Mock).mockResolvedValue({ ok: true });
    const { result } = await renderHook(() => useHoldingMutations(), { wrapper: Wrapper });

    await act(() =>
      result.current.create.mutateAsync({
        accountId: ACC,
        ticker: "CW8",
        kind: "etf",
        currency: "EUR",
        label: "Amundi MSCI World",
        quantity: 10,
        avgCost: 450,
      }),
    );
    await act(() =>
      result.current.recordLot.mutateAsync({
        holdingId: HLD,
        type: "buy",
        occurredOn: new Date("2026-11-20T00:00:00Z"),
        quantity: 2,
        priceUnit: 500,
        fees: 1,
      }),
    );
    await act(() => result.current.close.mutateAsync({ id: HLD }));

    expect(holdingsClient.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACC, ticker: "CW8", kind: "etf", quantity: 10 }),
    );
    expect(holdingsClient.recordLot).toHaveBeenCalledWith(
      expect.objectContaining({ holdingId: HLD, type: "buy", quantity: 2, priceUnit: 500 }),
    );
    expect(holdingsClient.close).toHaveBeenCalledWith({ id: HLD });
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(["portfolio", "cap"]));
  });

  it("realestate: property, valuation, mortgage, rental and delete", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    for (const fn of [
      "createProperty",
      "recordValuation",
      "attachMortgage",
      "updateMortgage",
      "attachRental",
      "updateRental",
      "deleteProperty",
    ] as const) {
      (realestateClient[fn] as jest.Mock).mockResolvedValue({ id: RE });
    }
    const { result } = await renderHook(() => useRealEstateMutations(), { wrapper: Wrapper });
    const day = new Date("2026-11-20T00:00:00Z");

    await act(() =>
      result.current.createProperty.mutateAsync({
        label: "Studio Lyon",
        propertyType: "locatif",
        currentValuation: 150000,
        lastValuedOn: day,
      }),
    );
    await act(() =>
      result.current.recordValuation.mutateAsync({ propertyId: RE, amount: 155000, valuedOn: day }),
    );
    await act(() =>
      result.current.attachMortgage.mutateAsync({
        propertyId: RE,
        outstandingPrincipal: 120000,
        annualRate: 0.035,
        monthlyPayment: 650,
        termMonths: 240,
        startDate: day,
      }),
    );
    await act(() =>
      result.current.updateMortgage.mutateAsync({ propertyId: RE, monthlyPayment: 700 }),
    );
    await act(() =>
      result.current.attachRental.mutateAsync({
        propertyId: RE,
        monthlyRent: 700,
        monthlyCharges: 80,
        furnished: true,
      }),
    );
    await act(() => result.current.updateRental.mutateAsync({ propertyId: RE, monthlyRent: 720 }));
    await act(() => result.current.deleteProperty.mutateAsync({ id: RE }));

    expect(realestateClient.createProperty).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Studio Lyon", propertyType: "locatif" }),
    );
    expect(realestateClient.recordValuation).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: RE, amount: 155000 }),
    );
    expect(realestateClient.attachMortgage).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: RE, annualRate: 0.035, termMonths: 240 }),
    );
    expect(realestateClient.updateMortgage).toHaveBeenCalledWith({
      propertyId: RE,
      monthlyPayment: 700,
    });
    expect(realestateClient.attachRental).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: RE, furnished: true }),
    );
    expect(realestateClient.updateRental).toHaveBeenCalledWith({
      propertyId: RE,
      monthlyRent: 720,
    });
    expect(realestateClient.deleteProperty).toHaveBeenCalledWith({ id: RE });
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining(["realestate", "cap"]));
  });

  it("monthly: sign off and reopen", async () => {
    const { Wrapper, invalidate } = wrapperFor(SESSION);
    (monthlyClient.signOffMonthly as jest.Mock).mockResolvedValue({});
    (monthlyClient.reopenMonthly as jest.Mock).mockResolvedValue({});
    const { result } = await renderHook(() => useMonthlyMutations(), { wrapper: Wrapper });

    const signOff = {
      year: 2026,
      monthNum: 11,
      incomeEur: 3400,
      spendingEur: 2100,
      transfersEur: 300,
      netChangeEur: 1000,
    };
    await act(() => result.current.signOff.mutateAsync(signOff));
    await act(() => result.current.reopen.mutateAsync({ year: 2026, monthNum: 10 }));

    expect(monthlyClient.signOffMonthly).toHaveBeenCalledWith(signOff);
    expect(monthlyClient.reopenMonthly).toHaveBeenCalledWith({ year: 2026, monthNum: 10 });
    expect(invalidatedKeys(invalidate)).toContain("monthly");
  });

  it("compass, AI opt-in and account deletion (then local sign-out)", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    (compassClient.updateCompass as jest.Mock).mockResolvedValue({});
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    (settingsClient.deleteAccount as jest.Mock).mockResolvedValue({ ok: true });
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });

    const compass = await renderHook(() => useCompassMutation(), { wrapper: Wrapper });
    await act(() => compass.result.current.mutateAsync({ objectif: 900000, horizonYears: 25 }));
    expect(compassClient.updateCompass).toHaveBeenCalledWith({
      objectif: 900000,
      horizonYears: 25,
    });

    const optIn = await renderHook(() => useLlmOptIn(), { wrapper: Wrapper });
    await waitFor(() => expect(optIn.result.current.thirdParty).toBe(false));
    await act(() => optIn.result.current.setThirdParty(true));
    expect(llmClient.setOptIn).toHaveBeenCalledWith({ thirdParty: true });

    const deletion = await renderHook(() => useDeleteUserAccount(), { wrapper: Wrapper });
    await act(() => deletion.result.current.mutateAsync({ confirmationEmail: "alex@pekulo.app" }));
    expect(settingsClient.deleteAccount).toHaveBeenCalledWith({
      confirmationEmail: "alex@pekulo.app",
    });
    expect(signOutSpy).toHaveBeenCalled();
  });

  it("preview mode: every mutation is blocked with PreviewModeError and no remote call", async () => {
    const { Wrapper } = wrapperFor(null);
    const { result } = await renderHook(() => useMilestoneMutations(), { wrapper: Wrapper });
    await expect(
      result.current.add.mutateAsync({ targetCapital: 1000, targetYear: 2030 }),
    ).rejects.toBeInstanceOf(PreviewModeError);
    expect(milestonesClient.add).not.toHaveBeenCalled();
  });
});

describe("AC-6 — form helpers mirror web parsing and close-window rules", () => {
  it("parses French amounts", () => {
    expect(parseAmountInput("1 234,50")).toBe(1234.5);
    expect(parseAmountInput("1 234.5 €")).toBe(1234.5);
    expect(parseAmountInput("-12,3")).toBe(-12.3);
    expect(Number.isNaN(parseAmountInput("abc"))).toBe(true);
    expect(Number.isNaN(parseAmountInput(""))).toBe(true);
  });

  it("formats local dates as ISO YYYY-MM-DD", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("shifts month keys across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("applies the web close window (last 5 days → 5 days after month end, UTC)", () => {
    expect(isWithinCloseWindow(2026, 11, new Date("2026-11-26T00:00:00Z"))).toBe(true);
    expect(isWithinCloseWindow(2026, 11, new Date("2026-12-05T23:00:00Z"))).toBe(true);
    expect(isWithinCloseWindow(2026, 11, new Date("2026-11-25T23:59:59Z"))).toBe(false);
    expect(isWithinCloseWindow(2026, 11, new Date("2026-12-06T00:00:00Z"))).toBe(false);
  });
});

describe("AC-6 — read hooks expose ids and raw values for edit sheets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transactions: month-scoped list with ids, raw rows and account options", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    const raw = {
      id: TX,
      accountId: ACC,
      occurredOn: "2026-10-03",
      label: "Loyer",
      amount: 900,
      type: "outflow",
      category: "loyer",
      isImprevu: false,
      notes: null,
      transferPairId: null,
      createdAt: "2026-10-03T00:00:00Z",
    };
    (transactionsClient.monthSummary as jest.Mock).mockResolvedValue({
      month: "2026-10",
      incomeEur: 0,
      spendingEur: 900,
      netChangeEur: -900,
    });
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({ items: [] });
    (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({ items: [raw] });
    (accountsClient.list as jest.Mock).mockResolvedValue([{ id: ACC, label: "Courant" }]);

    const { result } = await renderHook(() => useMobileTransactionsData("2026-10"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1));

    expect(transactionsClient.monthSummary).toHaveBeenCalledWith({ month: "2026-10" });
    expect(transactionsClient.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2026-10" }),
    );
    expect(result.current.data?.rows[0]).toEqual(
      expect.objectContaining({ id: TX, raw: expect.objectContaining({ label: "Loyer" }) }),
    );
    expect(result.current.data?.accountOptions).toEqual([{ value: ACC, label: "Courant" }]);
  });

  it("property detail, valuation history and compass are fetched by id", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    (realestateClient.getProperty as jest.Mock).mockResolvedValue({
      property: { id: RE, label: "Studio" },
      mortgage: null,
      rental: null,
    });
    (realestateClient.listValuations as jest.Mock).mockResolvedValue([
      { id: "resv_1", amount: 150000, valuedOn: new Date("2026-01-01T00:00:00Z") },
    ]);
    (compassClient.getCompass as jest.Mock).mockResolvedValue({
      objectif: 800000,
      horizonYears: 30,
    });

    const detail = await renderHook(() => useMobilePropertyDetail(RE), { wrapper: Wrapper });
    const history = await renderHook(() => useMobileValuations(RE), { wrapper: Wrapper });
    const compass = await renderHook(() => useMobileCompassData(), { wrapper: Wrapper });

    await waitFor(() => expect(detail.result.current.data?.property.label).toBe("Studio"));
    await waitFor(() => expect(history.result.current.data).toHaveLength(1));
    await waitFor(() => expect(compass.result.current.data?.objectif).toBe(800000));
    expect(realestateClient.getProperty).toHaveBeenCalledWith({ id: RE });
    expect(realestateClient.listValuations).toHaveBeenCalledWith({ propertyId: RE });
  });

  it("monthly: exposes the current month record for the sign-off sheet", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    const now = new Date();
    (monthlyClient.listMonthly as jest.Mock).mockResolvedValue({ items: [] });
    (monthlyClient.getMonthly as jest.Mock).mockResolvedValue({
      source: "derived",
      record: {
        year: now.getUTCFullYear(),
        monthNum: now.getUTCMonth() + 1,
        incomeEur: 3000,
        spendingEur: 2000,
        transfersEur: 100,
        netChangeEur: 900,
        signedOffAt: null,
      },
    });
    const { result } = await renderHook(() => useMobileMonthlyData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.current.incomeEur).toBe(3000));
    expect(monthlyClient.getMonthly).toHaveBeenCalledWith({
      year: now.getUTCFullYear(),
      monthNum: now.getUTCMonth() + 1,
    });
    expect(result.current.data?.current.signedOff).toBe(false);
  });
});
