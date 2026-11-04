import { describe, expect, it, vi, beforeEach } from "vitest";
import { ORPCError } from "@orpc/client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-2 (verbatim from story 12-4-advisory-private-page:18):
//   Given a non-allowlisted or banned user (status: "none" or "banned"), When they navigate to /dashboard/advisory,
//   Then they cannot reach the surface (server-side gate triggers redirect("/dashboard"), no advisory data leaks to the client, and all underlying Server Actions reject with 403 FORBIDDEN).
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

const mockStatus = vi.fn();
const mockGetLatestSession = vi.fn();
const mockGenerateAnalysis = vi.fn();

vi.mock("@/lib/orpc/modules", () => ({
  advisoryClient: {
    status: (...args: unknown[]) => mockStatus(...args),
    getLatestSession: (...args: unknown[]) => mockGetLatestSession(...args),
    generateAnalysis: (...args: unknown[]) => mockGenerateAnalysis(...args),
  },
}));

vi.mock("@/lib/orpc/request-context", () => ({
  ensureRequestContext: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAdvisoryStatus,
  getLatestAdvisorySession,
  generateAdvisoryAnalysis,
} from "./advisory-actions";

function makeSession() {
  return {
    id: "advs_123",
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
        fiscalite: {
          computation: "none",
          envelopes: [],
          properties: [],
          cryptoEur: 0,
        },
        fx: { base: "EUR", source: "live", asOf: "2026-10-27" },
      },
      analysis: {
        overview: "Solid financial base.",
        strengths: ["Strong savings rate"],
        risks: ["Equity concentration"],
        allocationAdvice: "Diversify across global ETFs.",
        recommendations: [
          {
            id: "rec_1",
            title: "Buy global bonds",
            action: "buy",
            target: "Bonds",
            rationale: "Reduce portfolio volatility.",
            priority: "high",
            instrumentRecommendation: {
              symbol: "AGGH",
              isin: "IE00BDBRDM35",
              action: "buy",
              rationale: "EUR-hedged global aggregate ETF.",
            },
          },
        ],
      },
      generatedAt: "2026-10-27T18:00:00.000Z",
    },
  };
}

describe("advisory-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAdvisoryStatus returns status from advisoryClient", async () => {
    mockStatus.mockResolvedValueOnce({ access: "active", owner: true });
    const res = await getAdvisoryStatus();
    expect(res).toEqual({ access: "active", owner: true });
    expect(mockStatus).toHaveBeenCalledTimes(1);
  });

  it("getLatestAdvisorySession returns null when no session exists", async () => {
    mockGetLatestSession.mockResolvedValueOnce(null);
    const res = await getLatestAdvisorySession();
    expect(res).toBeNull();
    expect(mockGetLatestSession).toHaveBeenCalledTimes(1);
  });

  it("generateAdvisoryAnalysis forwards input to advisoryClient", async () => {
    const fakeSession = makeSession();
    mockGenerateAnalysis.mockResolvedValueOnce(fakeSession);

    const res = await generateAdvisoryAnalysis({ forceRefresh: true });
    expect(res).toEqual(fakeSession);
    expect(mockGenerateAnalysis).toHaveBeenCalledWith({ forceRefresh: true });
  });

  // AC-2: the oRPC client is the enforcement point; the wrappers must not
  // swallow its 403. Each Server Action is asserted independently.
  it("getAdvisoryStatus rejects with FORBIDDEN for a non-allowlisted user", async () => {
    mockStatus.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN", { message: "advisory access required" }),
    );

    await expect(getAdvisoryStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("getLatestAdvisorySession rejects with FORBIDDEN for a non-allowlisted user", async () => {
    mockGetLatestSession.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN", { message: "advisory access required" }),
    );

    await expect(getLatestAdvisorySession()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("generateAdvisoryAnalysis rejects with FORBIDDEN for a non-allowlisted user", async () => {
    mockGenerateAnalysis.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN", { message: "advisory access required" }),
    );

    await expect(generateAdvisoryAnalysis({ forceRefresh: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
