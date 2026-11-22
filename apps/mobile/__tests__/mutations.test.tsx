import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTransactionInputSchema } from "@pekulo/validators";
import { ORPCError } from "@orpc/client";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { contractErrorCopy, handleMutationError } from "../lib/actions";
import {
  currentMonthKey,
  fromUtcDay,
  isWithinCloseWindow,
  parseAmountInput,
  percentToRatio,
  shiftMonthKey,
  toIsoDate,
  validateInput,
} from "../lib/forms";
import { formatCompactEur, formatEur } from "../lib/format";
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
import {
  accountDto,
  deleteAccountResult,
  holdingDto,
  lotDto,
  milestoneDto,
  monthlyRecordDto,
  mortgageDto,
  propertyDto,
  rentalDto,
  transactionDto,
} from "./helpers/contract-fixtures";

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
    (transactionsClient.createTransaction as jest.Mock).mockResolvedValue(transactionDto());
    (transactionsClient.updateTransaction as jest.Mock).mockResolvedValue(transactionDto());
    (transactionsClient.deleteTransaction as jest.Mock).mockResolvedValue({ ok: true });
    (transactionsClient.confirmCategorisation as jest.Mock).mockResolvedValue(transactionDto());
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
    (milestonesClient.add as jest.Mock).mockResolvedValue(milestoneDto());
    (milestonesClient.delete as jest.Mock).mockResolvedValue({ id: MST });
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
    for (const fn of ["create", "update", "recordBalanceChange"] as const) {
      (accountsClient[fn] as jest.Mock).mockResolvedValue(accountDto());
    }
    (accountsClient.delete as jest.Mock).mockResolvedValue({ ok: true });
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
    (holdingsClient.create as jest.Mock).mockResolvedValue(holdingDto());
    (holdingsClient.recordLot as jest.Mock).mockResolvedValue(lotDto());
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
    for (const fn of ["createProperty", "recordValuation"] as const) {
      (realestateClient[fn] as jest.Mock).mockResolvedValue(propertyDto());
    }
    for (const fn of ["attachMortgage", "updateMortgage"] as const) {
      (realestateClient[fn] as jest.Mock).mockResolvedValue(mortgageDto());
    }
    for (const fn of ["attachRental", "updateRental"] as const) {
      (realestateClient[fn] as jest.Mock).mockResolvedValue(rentalDto());
    }
    (realestateClient.deleteProperty as jest.Mock).mockResolvedValue({ ok: true });
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
    (monthlyClient.signOffMonthly as jest.Mock).mockResolvedValue(monthlyRecordDto());
    (monthlyClient.reopenMonthly as jest.Mock).mockResolvedValue(
      monthlyRecordDto({ monthNum: 10, signedOffAt: null }),
    );
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
    (compassClient.updateCompass as jest.Mock).mockResolvedValue({
      objectif: 900000,
      horizonYears: 25,
    });
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    (settingsClient.deleteAccount as jest.Mock).mockResolvedValue(deleteAccountResult());
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

  it("preview mode: EVERY mutation hook is blocked with PreviewModeError and no remote call", async () => {
    const { Wrapper } = wrapperFor(null);
    const blocked: [string, () => Promise<unknown>][] = [];
    const collect = (name: string, mutations: Record<string, unknown>) => {
      for (const [key, mutation] of Object.entries(mutations)) {
        const m = mutation as { mutateAsync?: (input: never) => Promise<unknown> };
        if (m && typeof m.mutateAsync === "function") {
          const call = m.mutateAsync;
          blocked.push([`${name}.${key}`, () => call({} as never)]);
        }
      }
    };

    const tx = await renderHook(() => useTransactionMutations(), { wrapper: Wrapper });
    const ms = await renderHook(() => useMilestoneMutations(), { wrapper: Wrapper });
    const acc = await renderHook(() => useAccountMutations(), { wrapper: Wrapper });
    const hld = await renderHook(() => useHoldingMutations(), { wrapper: Wrapper });
    const re = await renderHook(() => useRealEstateMutations(), { wrapper: Wrapper });
    const mon = await renderHook(() => useMonthlyMutations(), { wrapper: Wrapper });
    const cmp = await renderHook(() => useCompassMutation(), { wrapper: Wrapper });
    const del = await renderHook(() => useDeleteUserAccount(), { wrapper: Wrapper });
    collect("transactions", tx.result.current);
    collect("milestones", ms.result.current);
    collect("accounts", acc.result.current);
    collect("holdings", hld.result.current);
    collect("realestate", re.result.current);
    collect("monthly", mon.result.current);
    blocked.push(["compass", () => cmp.result.current.mutateAsync({} as never)]);
    blocked.push(["deleteAccount", () => del.result.current.mutateAsync({} as never)]);

    expect(blocked.length).toBeGreaterThanOrEqual(24);
    await Promise.all(
      blocked.map(([, call]) => expect(call()).rejects.toBeInstanceOf(PreviewModeError)),
    );

    const optIn = await renderHook(() => useLlmOptIn(), { wrapper: Wrapper });
    await expect(optIn.result.current.setThirdParty(true)).rejects.toBeInstanceOf(PreviewModeError);

    for (const client of [
      transactionsClient,
      milestonesClient,
      accountsClient,
      holdingsClient,
      realestateClient,
      monthlyClient,
      compassClient,
      llmClient,
      settingsClient,
    ] as Record<string, unknown>[]) {
      for (const fn of Object.values(client)) {
        expect((fn as jest.Mock).mock.calls).toHaveLength(0);
      }
    }
  });

  it("account deletion: a plain failure keeps the session (nothing was erased)", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
    (settingsClient.deleteAccount as jest.Mock).mockRejectedValue(
      new ORPCError("BANK_PROVIDER_UNAVAILABLE", { status: 503 }),
    );
    const { result } = await renderHook(() => useDeleteUserAccount(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ confirmationEmail: "alex@pekulo.app" }),
    ).rejects.toMatchObject({ code: "BANK_PROVIDER_UNAVAILABLE" });
    expect(signOutSpy).not.toHaveBeenCalled();
  });

  it("account deletion: ACCOUNT_PARTIALLY_ERASED ends the now-empty session and still reports the error", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
    (settingsClient.deleteAccount as jest.Mock).mockRejectedValue(
      new ORPCError("ACCOUNT_PARTIALLY_ERASED", { status: 500 }),
    );
    const { result } = await renderHook(() => useDeleteUserAccount(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ confirmationEmail: "alex@pekulo.app" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_PARTIALLY_ERASED" });
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});

describe("AC-6 — typed contract failures surface localised, specific feedback", () => {
  const handlers = () => ({ goToLogin: jest.fn(), toastDanger: jest.fn() });

  it.each([
    ["ACCOUNT_PARTIALLY_ERASED", "Suppression incomplète"],
    ["BANK_PROVIDER_UNAVAILABLE", "Banque indisponible"],
    ["MONTHLY_OUT_OF_WINDOW", "Clôture indisponible"],
    ["MONTHLY_SIGNED_OFF", "Mois déjà clôturé"],
    ["FORBIDDEN", "Action non autorisée"],
    ["TRANSACTION_NOT_FOUND", "Élément introuvable"],
    ["HOLDING_CLOSED", "Position clôturée"],
  ])("%s → toast titled “%s”, never the generic save failure", (code, title) => {
    const h = handlers();
    expect(handleMutationError(new ORPCError(code), h)).toBeNull();
    expect(h.toastDanger).toHaveBeenCalledWith(title, expect.any(String));
  });

  it("unknown failures keep the generic toast and unknown codes have no typed copy", () => {
    const h = handlers();
    handleMutationError(new Error("network"), h);
    expect(h.toastDanger).toHaveBeenCalledWith("Enregistrement impossible", expect.any(String));
    expect(contractErrorCopy(new ORPCError("SOMETHING_ELSE"))).toBeNull();
    expect(contractErrorCopy(new Error("x"))).toBeNull();
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

  it("parses English-style grouping, signs and trailing separators", () => {
    expect(parseAmountInput("1,234.50")).toBe(1234.5);
    expect(parseAmountInput("1.234,50")).toBe(1234.5);
    expect(parseAmountInput("1,234,567.89")).toBe(1234567.89);
    expect(parseAmountInput("5.")).toBe(5);
    expect(parseAmountInput("+5")).toBe(5);
    expect(parseAmountInput("−5,5")).toBe(-5.5);
    expect(Object.is(parseAmountInput("-0"), 0)).toBe(true);
    expect(Number.isNaN(parseAmountInput("1,2,3"))).toBe(true);
  });

  it("rounds percent → ratio without float noise", () => {
    expect(percentToRatio(1.1)).toBe(0.011);
    expect(percentToRatio(3.45)).toBe(0.0345);
    expect(1.1 / 100).not.toBe(0.011);
  });

  it("keeps UTC calendar days stable in any timezone", () => {
    const local = fromUtcDay(new Date("2020-03-01T00:00:00.000Z"));
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2020, 2, 1]);
    expect(fromUtcDay("2020-03-01T00:00:00.000Z").getDate()).toBe(1);
  });

  it("uses the UTC month as 'current', like the server and the web", () => {
    expect(currentMonthKey(new Date("2026-11-30T23:30:00.000Z"))).toBe("2026-11");
    expect(currentMonthKey(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12");
  });

  it("formats euros without '-0' and picks the compact unit from the rounded figure", () => {
    expect(formatEur(-0.4)).toBe("0 €");
    expect(formatCompactEur(-0.4)).toBe("0 €");
    expect(formatCompactEur(999_999)).toMatch(/^1\s?M€$/);
    expect(formatCompactEur(999_949)).toMatch(/^999,9\s?k€$/);
    expect(formatCompactEur(800_000)).toMatch(/^800\s?k€$/);
    expect(formatCompactEur(1_250_000)).toBe("1,3 M€");
  });

  it("localises validator failures by kind and keeps deliberate French copy", () => {
    const create = (over: Record<string, unknown>) =>
      validateInput(createTransactionInputSchema, {
        accountId: ACC,
        occurredOn: "2026-11-20",
        label: "Courses",
        amount: 10,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
        ...over,
      });
    expect(() => create({ amount: Number.NaN })).toThrow("Saisissez un montant valide.");
    expect(() => create({ label: "" })).toThrow("Libellé requis");
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
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
    });
    (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({
      items: [raw],
      nextCursor: null,
      totalCount: null,
    });
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
    expect(result.current.data?.listTruncated).toBe(false);
  });

  it("transactions: follows nextCursor up to 1 000 rows, then flags the month as truncated", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    (transactionsClient.monthSummary as jest.Mock).mockResolvedValue({
      month: "2026-10",
      incomeEur: 0,
      spendingEur: 0,
      netChangeEur: 0,
    });
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
    });
    (accountsClient.list as jest.Mock).mockResolvedValue([{ id: ACC, label: "Courant" }]);
    let counter = 0;
    (transactionsClient.listTransactions as jest.Mock).mockImplementation(async () => ({
      items: Array.from({ length: 200 }, () =>
        transactionDto({ id: `tx_${String((counter += 1)).padStart(21, "C")}` }),
      ),
      nextCursor: "more",
      totalCount: null,
    }));

    const { result } = await renderHook(() => useMobileTransactionsData("2026-10"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1000));

    expect(transactionsClient.listTransactions).toHaveBeenCalledTimes(5);
    expect(result.current.data?.listTruncated).toBe(true);
    expect(transactionsClient.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "more", limit: 200, month: "2026-10" }),
    );
  });

  it("transactions: exposes the full pending count, not the size of the first page", async () => {
    const { Wrapper } = wrapperFor(SESSION);
    (transactionsClient.monthSummary as jest.Mock).mockResolvedValue({
      month: "2026-10",
      incomeEur: 0,
      spendingEur: 0,
      netChangeEur: 0,
    });
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
      items: [transactionDto({ suggestedCategory: "courses", suggestedConfidence: 0.8 })],
      totalCount: 23,
      page: 1,
      pageSize: 10,
    });
    (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({
      items: [],
      nextCursor: null,
      totalCount: null,
    });
    (accountsClient.list as jest.Mock).mockResolvedValue([{ id: ACC, label: "Courant" }]);

    const { result } = await renderHook(() => useMobileTransactionsData("2026-10"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.pendingSuggestions).toHaveLength(1);
    expect(result.current.data?.pendingCount).toBe(23);
    expect(transactionsClient.listPendingSuggestions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      month: "2026-10",
    });
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
