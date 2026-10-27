// apps/api/src/modules/advisory/advisory-llm.service.test.ts
// Tests for advisory LLM service with audit logging (story 12-3, AC-1, AC-2, AC-3, AC-4).

import { describe, expect, it } from "bun:test";
import { createAdvisoryLlmService } from "./advisory-llm.service";
import type { AdvisorySnapshot } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";

const fixtureSnapshot: AdvisorySnapshot = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  wealth: {
    totalEur: 150000,
    investableEur: 120000,
    cashEur: 50000,
    investmentsEur: 70000,
    realEstateEquityEur: 30000,
    unrealizedPnlEur: 10000,
  },
  allocation: [
    { key: "cash", amountEur: 50000, pct: 33.33 },
    { key: "investments", amountEur: 70000, pct: 46.67 },
    { key: "real-estate", amountEur: 30000, pct: 20 },
  ],
  compass: {
    targetEur: 300000,
    currentWealthEur: 150000,
    percent: 50,
    gapEur: 150000,
  },
  monthlyCashflow: {
    year: 2026,
    monthNum: 5,
    incomeEur: 5000,
    spendingEur: 3000,
    transfersEur: 1000,
    netChangeEur: 1000,
    source: "persisted",
  },
  portfolio: {
    holdingsCount: 1,
    investedEur: 60000,
    marketValueEur: 70000,
    pnlEur: 10000,
    byKind: [
      { kind: "etf", marketValueEur: 70000, pct: 100 },
      { kind: "action", marketValueEur: 0, pct: 0 },
      { kind: "crypto", marketValueEur: 0, pct: 0 },
      { kind: "autre", marketValueEur: 0, pct: 0 },
    ],
    positions: [
      {
        holdingId: "hld_1234567890abcdef" as any,
        accountId: "acc_1",
        ticker: "CW8",
        label: "Amundi MSCI World",
        kind: "etf",
        currency: "EUR",
        quantity: 140,
        avgCost: 428.57,
        lastPrice: 500,
        marketValueEur: 70000,
        pnlEur: 10000,
        pnlPct: 16.67,
      },
    ],
  },
  fiscalite: {
    computation: "none",
    envelopes: [{ accountType: "pea", amountEur: 70000, pct: 46.67 }],
    properties: [{ propertyType: "residence-principale", netEquityEur: 30000, pct: 20 }],
    cryptoEur: 0,
  },
  fx: {
    base: "EUR",
    source: "fallback",
    asOf: "2026-05-01",
  },
};

const mockValidCompletion = JSON.stringify({
  overview: "Patrimoine total de 150000 € avec une réserve de 50000 € en cash.",
  strengths: ["Objectif compass à 50% atteint."],
  risks: ["Liquidités importantes (33.33%)."],
  allocationAdvice: "Investir progressivement les 50000 € de liquidités.",
  recommendations: [
    {
      id: "rec-1",
      title: "Renforcer CW8",
      action: "buy",
      target: "PEA",
      rationale: "Position CW8 actuelle à 500 € la part pour une valeur de 70000 €.",
      priority: "high",
      instrumentRecommendation: {
        symbol: "CW8",
        action: "buy",
        rationale: "Prix de 500 € attractif.",
      },
    },
  ],
});

// AC-2 (verbatim from story 12-3:18):
//   Given an advisory LLM call, When it completes (success or failure),
//   Then an intent + outcome pair is recorded via the single server-side writer
//   (LlmService.recordLlmCallPair), with no prompt text, user financial amounts,
//   or plaintext recommendations persisted in llm_call_log (task/label hash only).
describe("createAdvisoryLlmService (story 12-3)", () => {
  it("generates analysis, records audit pair, validates grounding, and persists session", async () => {
    let recordedPairs: any[] = [];
    const mockLlmService: any = {
      recordLlmCallPair: async (_userId: string, events: any) => {
        recordedPairs.push(events);
      },
    };

    let createdSessionData: any = null;
    const mockSessionRepo: any = {
      findLatestByUserId: async () => null,
      createSession: async (args: any) => {
        createdSessionData = args;
        return {
          id: "advs_created_1",
          userId: args.userId,
          snapshotVersion: args.snapshotVersion,
          model: args.model,
          provider: args.provider,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionData: args.sessionData,
        };
      },
      listByUserId: async () => [],
    };

    const mockAnalysisService: any = {
      getSnapshot: async () => fixtureSnapshot,
    };

    const mockLlmProvider: any = {
      route: "third_party" as const,
      complete: async () => ({
        raw: `\`\`\`json\n${mockValidCompletion}\n\`\`\``,
        latencyMs: 450,
      }),
    };

    const service = createAdvisoryLlmService({
      analysisService: mockAnalysisService,
      sessionRepository: mockSessionRepo,
      llmService: mockLlmService,
      llmProvider: mockLlmProvider,
      postureConfig: {
        baseUrl: "https://api.mistral.ai/v1/chat/completions",
        model: "mistral-small-latest",
      },
    });

    const result = await service.generateAnalysis("11111111-1111-4111-8111-111111111111");

    expect(result.id).toBe("advs_created_1");
    expect(result.sessionData.analysis.recommendations[0]?.action).toBe("buy");

    // AC-2: Verify audit call pair
    expect(recordedPairs).toHaveLength(1);
    const [intent, outcome] = recordedPairs[0];
    expect(intent.phase).toBe("intent");
    expect(intent.route).toBe("third_party");
    expect(outcome.phase).toBe("outcome");
    expect(outcome.outcome).toBe("success");
    expect(outcome.route).toBe("third_party");

    // Verify session persistence
    expect(createdSessionData.userId).toBe("11111111-1111-4111-8111-111111111111");
    expect(createdSessionData.provider).toBe("mistral");
  });

  it("records failure audit pair and throws PekuloError on LLM provider failure", async () => {
    let recordedPairs: any[] = [];
    const mockLlmService: any = {
      recordLlmCallPair: async (_userId: string, events: any) => {
        recordedPairs.push(events);
      },
    };

    const mockSessionRepo: any = {
      findLatestByUserId: async () => null,
      createSession: async () => {},
    };

    const mockAnalysisService: any = {
      getSnapshot: async () => fixtureSnapshot,
    };

    const mockLlmProvider: any = {
      route: "third_party" as const,
      complete: async () => {
        throw new Error("Mistral 503 Service Unavailable");
      },
    };

    const service = createAdvisoryLlmService({
      analysisService: mockAnalysisService,
      sessionRepository: mockSessionRepo,
      llmService: mockLlmService,
      llmProvider: mockLlmProvider,
      postureConfig: {},
    });

    await expect(service.generateAnalysis("11111111-1111-4111-8111-111111111111")).rejects.toThrow(
      PekuloError,
    );

    // Verify failure recorded in audit log
    expect(recordedPairs).toHaveLength(1);
    const [intent, outcome] = recordedPairs[0];
    expect(intent.phase).toBe("intent");
    expect(outcome.phase).toBe("outcome");
    expect(outcome.outcome).toBe("failure");
  });

  it("returns cached session if within 1h and forceRefresh is false", async () => {
    let providerCalled = false;
    const existingSession = {
      id: "advs_cached",
      userId: "11111111-1111-4111-8111-111111111111",
      snapshotVersion: 1,
      model: "mistral-small-latest",
      provider: "mistral",
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      sessionData: {
        snapshot: fixtureSnapshot,
        analysis: JSON.parse(mockValidCompletion),
        generatedAt: new Date().toISOString(),
      },
    };

    const service = createAdvisoryLlmService({
      analysisService: { getSnapshot: async () => fixtureSnapshot } as any,
      sessionRepository: {
        findLatestByUserId: async () => existingSession,
        createSession: async (args: any) => ({
          id: "advs_refreshed",
          ...args,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      } as any,
      llmService: {
        recordLlmCallPair: async () => {},
      } as any,
      llmProvider: {
        route: "third_party",
        complete: async () => {
          providerCalled = true;
          return { raw: mockValidCompletion, latencyMs: 100 };
        },
      } as any,
      postureConfig: {},
    });

    const cached = await service.generateAnalysis("11111111-1111-4111-8111-111111111111", false);
    expect(cached.id).toBe("advs_cached");
    expect(providerCalled).toBe(false);

    // With forceRefresh: true, provider is called
    await service.generateAnalysis("11111111-1111-4111-8111-111111111111", true);
    expect(providerCalled).toBe(true);
  });
});
