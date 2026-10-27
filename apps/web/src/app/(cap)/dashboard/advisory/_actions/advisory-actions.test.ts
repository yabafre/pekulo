import { describe, expect, it, vi, beforeEach } from "vitest";

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
    const fakeSession = {
      id: "advs_123",
      userId: "11111111-1111-4111-8111-111111111111",
      snapshotVersion: 1,
      model: "claude-3-5-sonnet",
      provider: "anthropic",
      createdAt: "2026-10-27T18:00:00.000Z",
      updatedAt: "2026-10-27T18:00:00.000Z",
      sessionData: {
        snapshot: {
          asOf: "2026-10-27T18:00:00.000Z",
          wealth: { totalGross: 100000, totalDebt: 0, totalNet: 100000 },
          allocation: [],
          compass: { targetWealth: 200000, gap: 100000, onTrack: true },
          monthlyCashflow: { income: 3000, expenses: 2000, savings: 1000, savingsRate: 33.3 },
          portfolio: { totalValue: 50000, unrealizedGain: 5000, returnPct: 10 },
          positions: [],
          byKind: [],
          fiscalite: { totalTaxEstimate: 0, byAccount: [], computation: "none" },
          fx: { ratesUsed: {}, hasCrossCurrency: false },
        },
        analysis: {
          overview: "Solid financial base.",
          strengths: ["Strong savings rate"],
          risks: ["Equity concentration"],
          allocationAdvice: "Diversify across global ETFs.",
          recommendations: [],
        },
        generatedAt: "2026-10-27T18:00:00.000Z",
      },
    };
    mockGenerateAnalysis.mockResolvedValueOnce(fakeSession);

    const res = await generateAdvisoryAnalysis({ forceRefresh: true });
    expect(res).toEqual(fakeSession);
    expect(mockGenerateAnalysis).toHaveBeenCalledWith({ forceRefresh: true });
  });
});
