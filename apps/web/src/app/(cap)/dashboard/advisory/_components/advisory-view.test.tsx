import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

const mockMutate = vi.fn();
const mockRefetch = vi.fn();
let mockSession: unknown = null;
let mockIsLoading = false;
let mockIsError = false;
let mockIsPending = false;

vi.mock("../_hooks/use-advisory", () => ({
  useAdvisoryStatus: () => ({ data: { access: "active", owner: true } }),
  useAdvisoryLatestSession: () => ({
    data: mockSession,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
  }),
  useGenerateAdvisoryAnalysis: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
  }),
}));

import { AdvisoryView } from "./advisory-view";

function makeSession() {
  return {
    id: "advs_1",
    userId: "11111111-1111-4111-8111-111111111111",
    snapshotVersion: 1,
    model: "claude-3-5-sonnet",
    provider: "anthropic",
    createdAt: "2026-10-27T18:00:00.000Z",
    updatedAt: "2026-10-27T18:00:00.000Z",
    sessionData: {
      snapshot: {
        schemaVersion: 1,
        baseCurrency: "EUR",
        wealth: {
          totalEur: 100000,
          investableEur: 60000,
          cashEur: 20000,
          investmentsEur: 40000,
          realEstateEquityEur: 40000,
          unrealizedPnlEur: 5000,
        },
        allocation: [
          { key: "cash", amountEur: 20000, pct: 20 },
          { key: "investments", amountEur: 40000, pct: 40 },
          { key: "real-estate", amountEur: 40000, pct: 40 },
        ],
        compass: {
          targetEur: 200000,
          currentWealthEur: 100000,
          percent: 50,
          gapEur: 100000,
        },
        monthlyCashflow: {
          year: 2026,
          monthNum: 10,
          incomeEur: 3000,
          spendingEur: 2000,
          transfersEur: 0,
          netChangeEur: 1000,
          source: "derived",
        },
        portfolio: null,
        fiscalite: { computation: "none", envelopes: [], properties: [], cryptoEur: 0 },
        fx: { base: "EUR", source: "live", asOf: "2026-10-27" },
      },
      analysis: {
        overview: "Portefeuille résilient avec 60% actions.",
        strengths: ["Bonne épargne de sécurité"],
        risks: ["Exposition USD"],
        allocationAdvice: "Renforcer les obligations d'État européennes.",
        recommendations: [
          {
            id: "rec_1",
            title: "Acheter ETF Obligations",
            action: "buy",
            target: "Obligations",
            rationale: "Stabiliser la volatilité.",
            priority: "high",
            instrumentRecommendation: {
              symbol: "AGGH",
              isin: "IE00BDBRDM35",
              action: "buy",
              rationale: "ETF global agrégé hedgé EUR.",
            },
          },
        ],
      },
      generatedAt: "2026-10-27T18:00:00.000Z",
    },
  };
}

function renderView() {
  return renderWithTamagui(<AdvisoryView initialStatus={{ access: "active", owner: true }} />);
}

describe("AdvisoryView", () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockRefetch.mockClear();
    mockIsError = false;
    mockIsPending = false;
  });

  it("renders regulatory disclaimer banner (AC-1)", () => {
    mockSession = null;
    mockIsLoading = false;
    renderView();
    expect(screen.getByRole("region", { name: "Avertissement réglementaire" })).toBeInTheDocument();
    expect(
      screen.getByText(/ne constitue en aucun cas un conseil en investissement réglementé/i),
    ).toBeInTheDocument();
  });

  it("renders empty state when no session exists and triggers generate", () => {
    mockSession = null;
    mockIsLoading = false;
    renderView();
    expect(screen.getByText("Aucune analyse disponible")).toBeInTheDocument();
    const generateBtns = screen.getAllByRole("button", { name: /Générer une analyse/i });
    fireEvent.click(generateBtns[0]!);
    expect(mockMutate).toHaveBeenCalledWith({ forceRefresh: true }, expect.any(Object));
  });

  it("renders an actionable error state when the session query fails", () => {
    mockSession = null;
    mockIsLoading = false;
    mockIsError = true;
    renderView();

    expect(screen.getByText("Analyse indisponible")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders session overview and recommendations with provider badge (AC-1, AC-3)", () => {
    mockSession = makeSession();
    mockIsLoading = false;

    renderView();

    expect(screen.getByText("Portefeuille résilient avec 60% actions.")).toBeInTheDocument();
    expect(screen.getByText("Acheter ETF Obligations")).toBeInTheDocument();
    expect(screen.getByText(/AGGH/)).toBeInTheDocument();
    expect(screen.getAllByText(/anthropic \/ claude-3-5-sonnet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Aucun entraînement/i)).toBeInTheDocument();
    expect(screen.getByText("Patrimoine total")).toBeInTheDocument();
    expect(screen.getAllByText(/100[\s\u00a0\u202f]000/).length).toBeGreaterThan(0);
  });
});
