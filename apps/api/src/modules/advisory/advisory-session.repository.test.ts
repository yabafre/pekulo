// apps/api/src/modules/advisory/advisory-session.repository.test.ts
// Tests for advisory session repository with encrypted persistence (story 12-3, AC-3).

import { describe, expect, it } from "bun:test";
import { createAdvisorySessionRepository } from "./advisory-session.repository";
import { createAdvisoryEncryptor } from "./advisory-encryption";
import type { AdvisorySessionData } from "@pekulo/validators";

const mockSessionData: AdvisorySessionData = {
  snapshot: {
    schemaVersion: 1,
    baseCurrency: "EUR",
    wealth: {
      totalEur: 100000,
      investableEur: 80000,
      cashEur: 30000,
      investmentsEur: 50000,
      realEstateEquityEur: 20000,
      unrealizedPnlEur: 5000,
    },
    allocation: [
      { key: "cash", amountEur: 30000, pct: 30 },
      { key: "investments", amountEur: 50000, pct: 50 },
      { key: "real-estate", amountEur: 20000, pct: 20 },
    ],
    compass: null,
    monthlyCashflow: {
      year: 2026,
      monthNum: 5,
      incomeEur: 4000,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1000,
      source: "persisted",
    },
    portfolio: null,
    fiscalite: {
      computation: "none",
      envelopes: [],
      properties: [],
      cryptoEur: 0,
    },
    fx: {
      base: "EUR",
      source: "fallback",
      asOf: null,
    },
  },
  analysis: {
    overview: "Diagnose overview",
    strengths: ["Force 1"],
    risks: ["Risque 1"],
    allocationAdvice: "Conseil",
    recommendations: [
      {
        id: "rec-1",
        title: "Action 1",
        action: "buy",
        target: "PEA",
        rationale: "Rationale 1",
        priority: "medium",
      },
    ],
  },
  generatedAt: new Date().toISOString(),
};

// AC-3 (verbatim from story 12-3:19):
//   Given a completed advisory session, When it is stored in advisory_sessions,
//   Then the record carries an ON DELETE CASCADE foreign key to auth.users(id),
//   is protected by a full symmetric RLS quartet (auth.uid() = user_id),
//   has its sensitive payload encrypted at rest with AES-256-GCM, and is registered
//   in id-prefixes.config.ts, settings.export.ts, settings.deletion.ts, and rls-audit.ts.
describe("createAdvisorySessionRepository (story 12-3)", () => {
  const encryptor = createAdvisoryEncryptor("secret-test-key-32-chars-long!");

  it("creates encrypted session and returns mapped DTO", async () => {
    let capturedCreateData: any = null;
    const mockDb: any = {
      advisorySession: {
        create: async ({ data }: any) => {
          capturedCreateData = data;
          return {
            id: "advs_abc123",
            userId: data.userId,
            snapshotVersion: data.snapshotVersion,
            encryptedPayload: data.encryptedPayload,
            model: data.model,
            provider: data.provider,
            createdAt: new Date("2026-05-01T12:00:00Z"),
            updatedAt: new Date("2026-05-01T12:00:00Z"),
          };
        },
      },
    };

    const repo = createAdvisorySessionRepository({
      client: mockDb,
      encryptor,
    });

    const session = await repo.createSession({
      userId: "11111111-1111-4111-8111-111111111111",
      snapshotVersion: 1,
      model: "mistral-small-latest",
      provider: "mistral",
      sessionData: mockSessionData,
    });

    expect(session.id).toBe("advs_abc123");
    expect(session.model).toBe("mistral-small-latest");
    expect(session.sessionData.analysis.overview).toBe("Diagnose overview");

    // Assert payload was encrypted at rest
    expect(capturedCreateData.encryptedPayload).not.toContain("Diagnose overview");
    expect(capturedCreateData.encryptedPayload.split(":")).toHaveLength(3);
  });

  it("finds latest session and decrypts stored payload", async () => {
    const encrypted = encryptor.encrypt(JSON.stringify(mockSessionData));
    const mockDb: any = {
      advisorySession: {
        findFirst: async ({ where, orderBy }: any) => {
          expect(where.userId).toBe("11111111-1111-4111-8111-111111111111");
          expect(orderBy.createdAt).toBe("desc");
          return {
            id: "advs_latest",
            userId: where.userId,
            snapshotVersion: 1,
            encryptedPayload: encrypted,
            model: "mistral-small",
            provider: "mistral",
            createdAt: new Date("2026-05-02T12:00:00Z"),
            updatedAt: new Date("2026-05-02T12:00:00Z"),
          };
        },
      },
    };

    const repo = createAdvisorySessionRepository({
      client: mockDb,
      encryptor,
    });

    const latest = await repo.findLatestByUserId("11111111-1111-4111-8111-111111111111");
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe("advs_latest");
    expect(latest?.sessionData.analysis.overview).toBe("Diagnose overview");
  });

  it("lists sessions and returns summaries with overview and count", async () => {
    const encrypted = encryptor.encrypt(JSON.stringify(mockSessionData));
    const mockDb: any = {
      advisorySession: {
        findMany: async ({ where, orderBy, take }: any) => {
          expect(where.userId).toBe("11111111-1111-4111-8111-111111111111");
          expect(orderBy.createdAt).toBe("desc");
          expect(take).toBe(20);
          return [
            {
              id: "advs_1",
              userId: where.userId,
              snapshotVersion: 1,
              encryptedPayload: encrypted,
              model: "mistral-small",
              provider: "mistral",
              createdAt: new Date("2026-05-02T12:00:00Z"),
              updatedAt: new Date("2026-05-02T12:00:00Z"),
            },
          ];
        },
      },
    };

    const repo = createAdvisorySessionRepository({
      client: mockDb,
      encryptor,
    });

    const list = await repo.listByUserId("11111111-1111-4111-8111-111111111111");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("advs_1");
    expect(list[0]?.overview).toBe("Diagnose overview");
    expect(list[0]?.recommendationsCount).toBe(1);
  });
});
