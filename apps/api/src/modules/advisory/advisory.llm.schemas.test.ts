// apps/api/src/modules/advisory/advisory.llm.schemas.test.ts
// Tests for advisory LLM schemas, types, and contract procedures (story 12-3, AC-1, AC-5).

import { describe, expect, it } from "bun:test";
import {
  ADVISORY_RECOMMENDATION_ACTIONS,
  ADVISORY_RECOMMENDATION_PRIORITIES,
  advisoryAnalysisResultSchema,
  advisoryRecommendationActionSchema,
  advisoryRecommendationPrioritySchema,
  advisorySessionListSchema,
  generateAnalysisInputSchema,
} from "@pekulo/validators";
import { advisoryContractV1 } from "@pekulo/contracts";

// AC-1 (verbatim from story 12-3:17):
//   Given a deterministic financial snapshot produced by the analysis engine,
//   When the advisory LLM task runs, Then the LLM returns structured analysis
//   and actionable recommendations (including instrument-level buy/sell/hold
//   guidance per ADR-0016 §2), and surfaces no monetary amount, percentage,
//   or price that is not present in the snapshot.
describe("advisory.llm.schemas (story 12-3)", () => {
  it("exports expected recommendation action and priority enums", () => {
    expect(ADVISORY_RECOMMENDATION_ACTIONS).toEqual([
      "buy",
      "sell",
      "hold",
      "trim",
      "rebalance",
      "allocate",
      "reduce",
    ]);
    expect(ADVISORY_RECOMMENDATION_PRIORITIES).toEqual(["high", "medium", "low"]);
    expect(advisoryRecommendationActionSchema.parse("buy")).toBe("buy");
    expect(advisoryRecommendationPrioritySchema.parse("high")).toBe("high");
  });

  it("validates generateAnalysisInputSchema default", () => {
    const input = generateAnalysisInputSchema.parse({});
    expect(input.forceRefresh).toBe(false);
  });

  it("validates advisorySessionListSchema shape", () => {
    const list = advisorySessionListSchema.parse({
      sessions: [
        {
          id: "advs_123",
          userId: "11111111-1111-4111-8111-111111111111",
          snapshotVersion: 1,
          model: "mistral-small",
          provider: "mistral",
          createdAt: new Date().toISOString(),
          overview: "Overview test",
          recommendationsCount: 1,
        },
      ],
      totalCount: 1,
    });
    expect(list.totalCount).toBe(1);
    expect(list.sessions[0]?.id).toBe("advs_123");
  });

  it("validates a compliant AdvisoryAnalysisResult with instrument recommendations", () => {
    const valid = {
      overview: "Saine posture financière avec liquidités abondantes.",
      strengths: ["Forte réserve de cash", "Pas d'endettement excessif"],
      risks: ["Sous-exposition aux actifs productifs"],
      allocationAdvice: "Allouer progressivement le surplus de cash vers les actions globales.",
      recommendations: [
        {
          id: "rec-1",
          title: "Allouer surplus cash vers CW8",
          action: "buy",
          target: "PEA",
          rationale: "Optimiser le rendement long terme sans frottement fiscal.",
          priority: "high",
          instrumentRecommendation: {
            symbol: "CW8",
            isin: "LU1681043599",
            action: "buy",
            rationale: "Diversification mondiale MSCI World.",
          },
        },
      ],
    };

    const parsed = advisoryAnalysisResultSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recommendations[0]?.action).toBe("buy");
      expect(parsed.data.recommendations[0]?.instrumentRecommendation?.symbol).toBe("CW8");
    }
  });

  it("rejects an invalid recommendation action", () => {
    const invalid = {
      overview: "Overview",
      strengths: ["Strength"],
      risks: ["Risk"],
      allocationAdvice: "Advice",
      recommendations: [
        {
          id: "rec-1",
          title: "Title",
          action: "short_sell", // invalid enum value
          target: "PEA",
          rationale: "Rationale",
          priority: "high",
        },
      ],
    };

    const parsed = advisoryAnalysisResultSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  // AC-5 (verbatim from story 12-3:21):
  //   Given the new advisory procedures (generateAnalysis, getLatestSession, listSessions),
  //   When called via /rpc/v1/advisory, Then they inherit the access gate from story 12-1
  //   (403 for non-allowlisted or banned users) before any snapshot or LLM call is triggered.
  it("declares generateAnalysis, getLatestSession, listSessions on advisoryContractV1", () => {
    expect(advisoryContractV1).toHaveProperty("generateAnalysis");
    expect(advisoryContractV1).toHaveProperty("getLatestSession");
    expect(advisoryContractV1).toHaveProperty("listSessions");
  });
});
