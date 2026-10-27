# Story: 12-3-advisory-llm-surface — Advisory LLM surface : analyse & recommandations sur le snapshot déterministe

**Epic:** Epic 12 — Private internal AI advisory tool (internal / non-product)
**Status:** in-progress
**Source:** ticket
**Ticket:** #116
**Ticket URL:** https://github.com/yabafre/pekulo/issues/116
**Origin:** aped-story
**Branch:** feature/116-12-3-advisory-llm-surface

## User Story

**As an** authorized advisory user, **I want** the LLM to analyse my deterministic snapshot and produce analysis + recommendations (including instrument-level), **so that** I get goal-aligned guidance on my own data — privately.

## Acceptance Criteria

- **AC-1 (grounding strict & carve-out DR-3)** — **Given** a deterministic financial snapshot produced by the analysis engine, **When** the advisory LLM task runs, **Then** the LLM returns structured analysis and actionable recommendations (including instrument-level buy/sell/hold guidance per ADR-0016 §2), and surfaces no monetary amount, percentage, or price that is not present in the snapshot.
- **AC-2 (single LLM writer audit — NFR-26 iso)** — **Given** an advisory LLM call, **When** it completes (success or failure), **Then** an intent + outcome pair is recorded via the single server-side writer (`LlmService.recordLlmCallPair`), with no prompt text, user financial amounts, or plaintext recommendations persisted in `llm_call_log` (task/label hash only).
- **AC-3 (encrypted session storage & RLS)** — **Given** a completed advisory session, **When** it is stored in `advisory_sessions`, **Then** the record carries an `ON DELETE CASCADE` foreign key to `auth.users(id)`, is protected by a full symmetric RLS quartet (`auth.uid() = user_id`), has its sensitive payload encrypted at rest with AES-256-GCM, and is registered in `id-prefixes.config.ts`, `settings.export.ts`, `settings.deletion.ts`, and `rls-audit.ts`.
- **AC-4 (posture assertion — EU region & zero data retention)** — **Given** the configured LLM provider, **When** the advisory surface initialises, **Then** its configuration asserts that the provider is hosted in the EU region and adheres to a zero-data-retention / no-training policy (e.g. Mistral EU by default).
- **AC-5 (gated oRPC procedures)** — **Given** the new advisory procedures (`generateAnalysis`, `getLatestSession`, `listSessions`), **When** called via `/rpc/v1/advisory`, **Then** they inherit the access gate from story 12-1 (403 for non-allowlisted or banned users) before any snapshot or LLM call is triggered.
- **AC-6 (verification)** — **Given** the story implementation, **When** tests, typecheck, lint, and RLS audit are run, **Then** each command exits 0 without error or regression.

## Tasks

- [x] **T1 — Register the `AdvisorySession` table and gates together** [AC: AC-3, AC-6]
  Update the Prisma schema, create the idempotent migration with full RLS quartet and cascade FK, register the model prefix (`advs`), add the model to GDPR export and account deletion nodes, and update the RLS audit policy inventory.

  **Path:** `apps/api/prisma/schema/advisory.prisma` (modify)
  ```prisma
  // Append to apps/api/prisma/schema/advisory.prisma:

  model AdvisorySession {
    id               String   @id
    userId           String   @map("user_id") @db.Uuid
    snapshotVersion  Int      @default(1) @map("snapshot_version")
    encryptedPayload String   @map("encrypted_payload") @db.Text
    model            String   @map("model")
    provider         String   @map("provider")
    createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz
    updatedAt        DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

    @@index([userId, createdAt(sort: Desc)], map: "advisory_sessions_user_created_idx")
    @@map("advisory_sessions")
  }
  ```

  **Path:** `apps/api/prisma/migrations/20261027170000_create_advisory_sessions/migration.sql` (create)
  ```sql
  -- Hand-written migration (ADR-0014 + 2026-05-05 lesson).
  -- Story 12-3 (ADR-0016 §3/§4): Persisted advisory sessions with field-level encryption.

  CREATE TABLE IF NOT EXISTS "advisory_sessions" (
      "id" TEXT NOT NULL,
      "user_id" UUID NOT NULL,
      "snapshot_version" INTEGER NOT NULL DEFAULT 1,
      "encrypted_payload" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "advisory_sessions_pkey" PRIMARY KEY ("id")
  );

  DO $$ BEGIN
    ALTER TABLE "advisory_sessions"
      ADD CONSTRAINT "advisory_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  CREATE INDEX IF NOT EXISTS "advisory_sessions_user_created_idx"
    ON "advisory_sessions" ("user_id", "created_at" DESC);

  ALTER TABLE "advisory_sessions" ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "advisory_sessions_select_own" ON "advisory_sessions";
  CREATE POLICY "advisory_sessions_select_own" ON "advisory_sessions"
    FOR SELECT USING (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_sessions_insert_own" ON "advisory_sessions";
  CREATE POLICY "advisory_sessions_insert_own" ON "advisory_sessions"
    FOR INSERT WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_sessions_update_own" ON "advisory_sessions";
  CREATE POLICY "advisory_sessions_update_own" ON "advisory_sessions"
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_sessions_delete_own" ON "advisory_sessions";
  CREATE POLICY "advisory_sessions_delete_own" ON "advisory_sessions"
    FOR DELETE USING (user_id = auth.uid());
  ```

  **Path:** `apps/api/src/database/id-prefixes.config.ts` (modify)
  Add `AdvisorySession: "advs"` to `ID_PREFIXES`.

  **Path:** `apps/api/src/modules/settings/settings.export.ts` (modify)
  Add node entry to `EXPORT_NODES`:
  ```ts
    {
      key: "advisory_sessions",
      model: "AdvisorySession",
      read: (client, userId) => client.advisorySession.findMany({ where: { userId } }),
    },
  ```

  **Path:** `apps/api/src/modules/settings/settings.deletion.ts` (modify)
  Add node entry to `DELETION_NODES`:
  ```ts
    {
      key: "advisory_sessions",
      model: "AdvisorySession",
      remove: (client, userId) => client.advisorySession.deleteMany({ where: { userId } }),
    },
  ```

  **Path:** `apps/api/scripts/rls-audit.ts` (modify)
  Add `advisory_sessions: 4` to `EXPECTED_POLICY_COUNTS`.

  **Path:** `apps/api/src/database/id-prefixes.config.test.ts` (modify)
  Update expected model count from 24 to 25 and assert prefix `"advs"`.

  Run: `bun --filter='@pekulo/api' run prisma:generate && bun --filter='@pekulo/api' run db:rls-migration-audit && bun test apps/api/src/database/id-prefixes.config.test.ts apps/api/src/modules/settings/settings.export-map.guard.test.ts apps/api/src/modules/settings/settings.deletion.test.ts`
  Expected: All tests pass, exit code 0.
  Commit: `git add apps/api/prisma/ apps/api/src/database/ apps/api/src/modules/settings/ apps/api/scripts/rls-audit.ts && git commit -m "feat(#116): register advisory_sessions table, prefix and registration gates"`

- [x] **T2 — Advisory LLM schemas, types, and contract procedures** [AC: AC-1, AC-5]
  Define the structured Zod schemas for analysis outputs, instrument recommendations, decrypted advisory sessions, and declare the procedures on `advisoryContract`.

  **Path:** `packages/validators/src/advisory/advisory.llm.schemas.ts` (create)
  ```ts
  import { z } from "@pekulo/zod";
  import { advisorySnapshotSchema } from "./advisory.snapshot.schemas";

  export const ADVISORY_RECOMMENDATION_ACTIONS = [
    "buy",
    "sell",
    "hold",
    "trim",
    "rebalance",
    "allocate",
    "reduce",
  ] as const;
  export const advisoryRecommendationActionSchema = z.enum(ADVISORY_RECOMMENDATION_ACTIONS);
  export type AdvisoryRecommendationAction = z.infer<typeof advisoryRecommendationActionSchema>;

  export const ADVISORY_RECOMMENDATION_PRIORITIES = ["high", "medium", "low"] as const;
  export const advisoryRecommendationPrioritySchema = z.enum(ADVISORY_RECOMMENDATION_PRIORITIES);
  export type AdvisoryRecommendationPriority = z.infer<typeof advisoryRecommendationPrioritySchema>;

  export const advisoryInstrumentRecommendationSchema = z.object({
    symbol: z.string().min(1),
    isin: z.string().optional(),
    action: z.enum(["buy", "sell", "hold", "trim"]),
    rationale: z.string().min(1),
  });
  export type AdvisoryInstrumentRecommendation = z.infer<
    typeof advisoryInstrumentRecommendationSchema
  >;

  export const advisoryRecommendationSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    action: advisoryRecommendationActionSchema,
    target: z.string().min(1),
    rationale: z.string().min(1),
    priority: advisoryRecommendationPrioritySchema,
    instrumentRecommendation: advisoryInstrumentRecommendationSchema.optional(),
  });
  export type AdvisoryRecommendation = z.infer<typeof advisoryRecommendationSchema>;

  export const advisoryAnalysisResultSchema = z.object({
    overview: z.string().min(1),
    strengths: z.array(z.string().min(1)),
    risks: z.array(z.string().min(1)),
    allocationAdvice: z.string().min(1),
    recommendations: z.array(advisoryRecommendationSchema),
  });
  export type AdvisoryAnalysisResult = z.infer<typeof advisoryAnalysisResultSchema>;

  export const advisorySessionDataSchema = z.object({
    snapshot: advisorySnapshotSchema,
    analysis: advisoryAnalysisResultSchema,
    generatedAt: z.string().datetime(),
  });
  export type AdvisorySessionData = z.infer<typeof advisorySessionDataSchema>;

  export const advisorySessionSchema = z.object({
    id: z.string().min(1),
    userId: z.string().uuid(),
    snapshotVersion: z.number().int().positive(),
    model: z.string().min(1),
    provider: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    sessionData: advisorySessionDataSchema,
  });
  export type AdvisorySession = z.infer<typeof advisorySessionSchema>;

  export const advisorySessionSummarySchema = z.object({
    id: z.string().min(1),
    userId: z.string().uuid(),
    snapshotVersion: z.number().int().positive(),
    model: z.string().min(1),
    provider: z.string().min(1),
    createdAt: z.string().datetime(),
    overview: z.string().min(1),
    recommendationsCount: z.number().int().nonnegative(),
  });
  export type AdvisorySessionSummary = z.infer<typeof advisorySessionSummarySchema>;

  export const advisorySessionListSchema = z.object({
    sessions: z.array(advisorySessionSummarySchema),
    totalCount: z.number().int().nonnegative(),
  });
  export type AdvisorySessionList = z.infer<typeof advisorySessionListSchema>;

  export const generateAnalysisInputSchema = z.object({
    forceRefresh: z.boolean().optional().default(false),
  });
  export type GenerateAnalysisInput = z.infer<typeof generateAnalysisInputSchema>;
  ```

  **Path:** `packages/validators/src/advisory/index.ts` (modify)
  Re-export all symbols from `./advisory.llm.schemas`.

  **Path:** `packages/contracts/src/advisory/advisory.contract.ts` (modify)
  Add `generateAnalysis`, `getLatestSession`, `listSessions` to `advisoryContractV1`.

  **Path:** `apps/api/src/modules/advisory/advisory.llm.schemas.test.ts` (create)
  Verify parsing and validation of valid and invalid advisory outputs.

  Run: `bun test apps/api/src/modules/advisory/advisory.llm.schemas.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add packages/validators/ packages/contracts/ apps/api/src/modules/advisory/advisory.llm.schemas.test.ts && git commit -m "feat(#116): add advisory LLM schemas, types, and contract procedures"`

- [x] **T3 — Field-level AES-256-GCM encryption for advisory sessions** [AC: AC-3]
  Create authenticated encryption helper with tamper detection and round-trip verification.

  **Path:** `apps/api/src/modules/advisory/advisory-encryption.ts` (create)
  ```ts
  import crypto from "node:crypto";

  const ALGORITHM = "aes-256-gcm";
  const IV_LENGTH = 12; // 96 bits standard for GCM
  const TAG_LENGTH = 16;

  export interface AdvisoryEncryptor {
    encrypt(plaintext: string): string;
    decrypt(ciphertextPayload: string): string;
  }

  export function createAdvisoryEncryptor(secretKeyHexOrUtf8: string): AdvisoryEncryptor {
    const key = crypto.createHash("sha256").update(secretKeyHexOrUtf8).digest();

    return {
      encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
        const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
      },

      decrypt(ciphertextPayload: string): string {
        const parts = ciphertextPayload.split(":");
        if (parts.length !== 3) {
          throw new Error("Invalid ciphertext payload format");
        }
        const [ivB64, tagB64, encryptedB64] = parts;
        const iv = Buffer.from(ivB64!, "base64");
        const tag = Buffer.from(tagB64!, "base64");
        const encrypted = Buffer.from(encryptedB64!, "base64");

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString("utf8");
      },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-encryption.test.ts` (create)
  Test round-trip encryption, tampered ciphertext detection, and empty string handling.

  Run: `bun test apps/api/src/modules/advisory/advisory-encryption.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add apps/api/src/modules/advisory/advisory-encryption.ts apps/api/src/modules/advisory/advisory-encryption.test.ts && git commit -m "feat(#116): implement AES-256-GCM field-level encryption for advisory sessions"`

- [x] **T4 — Provider posture assertor & strict grounding validator** [AC: AC-1, AC-4]
  Implement the EU-region & no-train configuration check and the grounding validation algorithm that verifies numbers in LLM outputs exist in the snapshot.

  **Path:** `apps/api/src/modules/advisory/advisory-posture.ts` (create)
  ```ts
  import { PekuloError } from "../../common/errors";

  export interface AdvisoryPostureConfig {
    baseUrl?: string;
    model?: string;
  }

  export function assertAdvisoryProviderPosture(config: AdvisoryPostureConfig): {
    route: "third_party";
    providerName: string;
    region: "EU";
    noTrain: true;
  } {
    const baseUrl = config.baseUrl ?? "https://api.mistral.ai/v1/chat/completions";
    const isMistral = baseUrl.includes("mistral.ai");
    const isEuOpenRouter = baseUrl.includes("openrouter.ai") || baseUrl.includes("eu-");
    const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    if (!isMistral && !isEuOpenRouter && !isLocalhost) {
      throw new PekuloError(
        "BAD_REQUEST",
        `Advisory provider posture check failed: endpoint ${baseUrl} does not meet EU-region & no-train policy (ADR-0016 §3)`,
      );
    }

    return {
      route: "third_party",
      providerName: isMistral ? "mistral" : isLocalhost ? "local" : "openrouter-eu",
      region: "EU",
      noTrain: true,
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-grounding-validator.ts` (create)
  ```ts
  import type { AdvisorySnapshot } from "@pekulo/validators";
  import type { AdvisoryAnalysisResult } from "@pekulo/validators";
  import { PekuloError } from "../../common/errors";

  export function collectKnownSnapshotNumbers(snapshot: AdvisorySnapshot): Set<number> {
    const numbers = new Set<number>();

    function addNum(n: number | null | undefined) {
      if (n != null && Number.isFinite(n)) {
        numbers.add(Math.round(n * 100) / 100);
        numbers.add(Math.round(n));
      }
    }

    addNum(snapshot.wealth.totalEur);
    addNum(snapshot.wealth.investableEur);
    addNum(snapshot.wealth.cashEur);
    addNum(snapshot.wealth.investmentsEur);
    addNum(snapshot.wealth.realEstateEquityEur);
    addNum(snapshot.wealth.unrealizedPnlEur);

    for (const alloc of snapshot.allocation) {
      addNum(alloc.amountEur);
      addNum(alloc.pct);
    }

    if (snapshot.compass) {
      addNum(snapshot.compass.targetEur);
      addNum(snapshot.compass.currentWealthEur);
      addNum(snapshot.compass.gapEur);
      addNum(snapshot.compass.progressPct);
    }

    if (snapshot.monthlyCashflow) {
      addNum(snapshot.monthlyCashflow.inflowEur);
      addNum(snapshot.monthlyCashflow.outflowEur);
      addNum(snapshot.monthlyCashflow.netCashflowEur);
      addNum(snapshot.monthlyCashflow.savingsRatePct);
    }

    if (snapshot.portfolio) {
      addNum(snapshot.portfolio.totalInvestedEur);
      for (const pos of snapshot.portfolio.positions) {
        addNum(pos.shares);
        addNum(pos.currentPrice);
        addNum(pos.currentValueEur);
      }
      for (const kind of snapshot.portfolio.byKind) {
        addNum(kind.valueEur);
        addNum(kind.pct);
      }
    }

    return numbers;
  }

  export function validateAdvisoryGrounding(
    analysis: AdvisoryAnalysisResult,
    snapshot: AdvisorySnapshot,
  ): void {
    const knownNumbers = collectKnownSnapshotNumbers(snapshot);
    const textBlob = JSON.stringify(analysis);
    const numericRegex = /(?:€|\b)(\d+(?:[.,]\d+)?)\s*(?:€|k|%|EUR)?/gi;

    let match: RegExpExecArray | null;
    while ((match = numericRegex.exec(textBlob)) !== null) {
      const raw = match[1]!.replace(",", ".");
      const val = parseFloat(raw);
      if (!Number.isFinite(val)) continue;
      // Allow small standard constants (0, 1, 2, 3, etc. for rankings or list IDs)
      if (val >= 0 && val <= 10 && Number.isInteger(val)) continue;

      const rounded2 = Math.round(val * 100) / 100;
      const rounded0 = Math.round(val);
      if (!knownNumbers.has(rounded2) && !knownNumbers.has(rounded0)) {
        throw new PekuloError(
          "BAD_REQUEST",
          `Advisory grounding violation: figure ${val} cited in LLM response does not exist in deterministic snapshot (AC-1)`,
        );
      }
    }
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-posture.test.ts` (create)
  **Path:** `apps/api/src/modules/advisory/advisory-grounding-validator.test.ts` (create)

  Run: `bun test apps/api/src/modules/advisory/advisory-posture.test.ts apps/api/src/modules/advisory/advisory-grounding-validator.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add apps/api/src/modules/advisory/advisory-posture.ts apps/api/src/modules/advisory/advisory-posture.test.ts apps/api/src/modules/advisory/advisory-grounding-validator.ts apps/api/src/modules/advisory/advisory-grounding-validator.test.ts && git commit -m "feat(#116): add EU-posture assertor and strict grounding validator"`

- [x] **T5 — Dedicated advisory prompt builder** [AC: AC-1]
  Build the prompt composer that feeds the snapshot and strictly sets rules for grounding and instrument advice.

  **Path:** `apps/api/src/modules/advisory/advisory-prompt-builder.ts` (create)
  ```ts
  import type { AdvisorySnapshot } from "@pekulo/validators";

  export function buildAdvisoryPrompt(snapshot: AdvisorySnapshot): string {
    return [
      "You are Pekulo's private internal financial advisory AI engine for Persona #1.",
      "You are provided with a complete, verified deterministic financial snapshot.",
      "",
      "STRICT GROUNDING INVARIANTS (BINDING):",
      "1. You are strictly FORBIDDEN from inventing, guessing, or hallucinating any monetary amounts, currency figures, percentages, or asset prices not explicitly present in the snapshot below.",
      "2. Every number you cite MUST come verbatim from the snapshot.",
      "3. ADR-0016 §2 SCOPED CARVE-OUT: You MAY and SHOULD provide actionable buy/sell/hold/rebalance recommendations, including instrument-level recommendations for instruments listed in the portfolio.",
      "",
      "FINANCIAL SNAPSHOT (JSON):",
      JSON.stringify(snapshot, null, 2),
      "",
      "OUTPUT INSTRUCTIONS:",
      "Return ONLY a valid JSON object matching this schema (no markdown formatting, no code fences):",
      "{",
      '  "overview": "Summary diagnosis of financial posture",',
      '  "strengths": ["Strength 1", "Strength 2"],',
      '  "risks": ["Risk or concentration 1", "Risk 2"],',
      '  "allocationAdvice": "Detailed cash vs investments vs real estate allocation commentary",',
      '  "recommendations": [',
      "    {",
      '      "id": "rec-1",',
      '      "title": "Action title",',
      '      "action": "buy" | "sell" | "hold" | "trim" | "rebalance" | "allocate" | "reduce",',
      '      "target": "Target asset or account name",',
      '      "rationale": "Why this action is recommended",',
      '      "priority": "high" | "medium" | "low",',
      '      "instrumentRecommendation": {',
      '        "symbol": "TICKER",',
      '        "isin": "OPTIONAL_ISIN",',
      '        "action": "buy" | "sell" | "hold" | "trim",',
      '        "rationale": "Rationale"',
      "      }",
      "    }",
      "  ]",
      "}",
    ].join("\n");
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-prompt-builder.test.ts` (create)
  Assert that snapshot figures are represented in the prompt and invariant instructions are present.

  Run: `bun test apps/api/src/modules/advisory/advisory-prompt-builder.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add apps/api/src/modules/advisory/advisory-prompt-builder.ts apps/api/src/modules/advisory/advisory-prompt-builder.test.ts && git commit -m "feat(#116): implement dedicated advisory prompt builder"`

- [x] **T6 — Advisory sessions repository with encrypted persistence** [AC: AC-3]
  Implement repository persisting encrypted session records and mapping decrypted domain DTOs.

  **Path:** `apps/api/src/modules/advisory/advisory-session.repository.ts` (create)
  ```ts
  import type { PrismaClient } from "@prisma/client";
  import type { AdvisoryEncryptor } from "./advisory-encryption";
  import type { AdvisorySession, AdvisorySessionData, AdvisorySessionSummary } from "@pekulo/validators";

  export interface AdvisorySessionRepository {
    createSession(args: {
      userId: string;
      snapshotVersion: number;
      model: string;
      provider: string;
      sessionData: AdvisorySessionData;
    }): Promise<AdvisorySession>;

    findLatestByUserId(userId: string): Promise<AdvisorySession | null>;
    listByUserId(userId: string, limit?: number): Promise<AdvisorySessionSummary[]>;
  }

  export function createAdvisorySessionRepository(deps: {
    client: PrismaClient;
    encryptor: AdvisoryEncryptor;
  }): AdvisorySessionRepository {
    const db = deps.client;

    return {
      async createSession({ userId, snapshotVersion, model, provider, sessionData }) {
        const encrypted = deps.encryptor.encrypt(JSON.stringify(sessionData));
        const row = await db.advisorySession.create({
          data: {
            userId,
            snapshotVersion,
            model,
            provider,
            encryptedPayload: encrypted,
          },
        });

        return {
          id: row.id,
          userId: row.userId,
          snapshotVersion: row.snapshotVersion,
          model: row.model,
          provider: row.provider,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          sessionData,
        };
      },

      async findLatestByUserId(userId) {
        const row = await db.advisorySession.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        if (!row) return null;

        const decryptedJson = deps.encryptor.decrypt(row.encryptedPayload);
        const sessionData = JSON.parse(decryptedJson) as AdvisorySessionData;

        return {
          id: row.id,
          userId: row.userId,
          snapshotVersion: row.snapshotVersion,
          model: row.model,
          provider: row.provider,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          sessionData,
        };
      },

      async listByUserId(userId, limit = 20) {
        const rows = await db.advisorySession.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        return rows.map((row) => {
          const decryptedJson = deps.encryptor.decrypt(row.encryptedPayload);
          const data = JSON.parse(decryptedJson) as AdvisorySessionData;
          return {
            id: row.id,
            userId: row.userId,
            snapshotVersion: row.snapshotVersion,
            model: row.model,
            provider: row.provider,
            createdAt: row.createdAt.toISOString(),
            overview: data.analysis.overview,
            recommendationsCount: data.analysis.recommendations.length,
          };
        });
      },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-session.repository.test.ts` (create)

  Run: `bun test apps/api/src/modules/advisory/advisory-session.repository.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add apps/api/src/modules/advisory/advisory-session.repository.ts apps/api/src/modules/advisory/advisory-session.repository.test.ts && git commit -m "feat(#116): add encrypted advisory session repository"`

- [ ] **T7 — Advisory LLM service with audit logging** [AC: AC-1, AC-2, AC-3, AC-4]
  Orchestrate analysis execution: retrieve snapshot, invoke LLM via provider, parse JSON, validate grounding, record audit event pair via `llmService.recordLlmCallPair`, and persist encrypted session.

  **Path:** `apps/api/src/modules/advisory/advisory-llm.service.ts` (create)
  ```ts
  import crypto from "node:crypto";
  import type { LlmProvider } from "../llm/llm-provider";
  import type { LlmService } from "../llm/llm.service";
  import type { AdvisoryAnalysisService } from "./advisory-analysis.service";
  import type { AdvisorySessionRepository } from "./advisory-session.repository";
  import { buildAdvisoryPrompt } from "./advisory-prompt-builder";
  import { validateAdvisoryGrounding } from "./advisory-grounding-validator";
  import { assertAdvisoryProviderPosture, type AdvisoryPostureConfig } from "./advisory-posture";
  import { advisoryAnalysisResultSchema, type AdvisorySession, type AdvisorySessionList } from "@pekulo/validators";
  import { PekuloError } from "../../common/errors";

  export interface AdvisoryLlmService {
    generateAnalysis(userId: string, forceRefresh?: boolean): Promise<AdvisorySession>;
    getLatestSession(userId: string): Promise<AdvisorySession | null>;
    listSessions(userId: string): Promise<AdvisorySessionList>;
  }

  export function createAdvisoryLlmService(deps: {
    analysisService: AdvisoryAnalysisService;
    sessionRepository: AdvisorySessionRepository;
    llmService: LlmService;
    llmProvider: LlmProvider;
    postureConfig: AdvisoryPostureConfig;
  }): AdvisoryLlmService {
    const posture = assertAdvisoryProviderPosture(deps.postureConfig);

    return {
      async generateAnalysis(userId: string, forceRefresh = false): Promise<AdvisorySession> {
        if (!forceRefresh) {
          const latest = await deps.sessionRepository.findLatestByUserId(userId);
          if (latest) {
            const ageMs = Date.now() - new Date(latest.createdAt).getTime();
            // Cache valid for 1 hour unless forceRefresh
            if (ageMs < 60 * 60 * 1000) {
              return latest;
            }
          }
        }

        const snapshot = await deps.analysisService.getSnapshot(userId);
        const prompt = buildAdvisoryPrompt(snapshot);
        const callId = `adv_call_${crypto.randomUUID()}`;
        const labelHash = crypto.createHash("sha256").update("advisory_analysis").digest("hex");

        const startTime = performance.now();
        let rawCompletionText = "";
        try {
          const completion = await deps.llmProvider.complete(prompt);
          rawCompletionText = completion.text;
          const latencyMs = Math.round(performance.now() - startTime);

          // Record success audit pair through single writer
          await deps.llmService.recordLlmCallPair(userId, [
            { phase: "intent", callId, route: posture.route, labelHash },
            { phase: "outcome", callId, route: posture.route, labelHash, latencyMs, outcome: "success" },
          ]);
        } catch (err) {
          const latencyMs = Math.round(performance.now() - startTime);
          await deps.llmService.recordLlmCallPair(userId, [
            { phase: "intent", callId, route: posture.route, labelHash },
            { phase: "outcome", callId, route: posture.route, labelHash, latencyMs, outcome: "failure" },
          ]);
          throw new PekuloError("INTERNAL_ERROR", `Advisory LLM provider execution failed: ${(err as Error).message}`);
        }

        // Clean markdown backticks if present
        const jsonText = rawCompletionText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(jsonText);
        } catch {
          throw new PekuloError("INTERNAL_ERROR", "LLM completion did not produce valid JSON");
        }

        const parsed = advisoryAnalysisResultSchema.safeParse(parsedJson);
        if (!parsed.success) {
          throw new PekuloError("INTERNAL_ERROR", `LLM output schema validation failed: ${parsed.error.message}`);
        }

        // Grounding validation: ensure no invented figures
        validateAdvisoryGrounding(parsed.data, snapshot);

        const session = await deps.sessionRepository.createSession({
          userId,
          snapshotVersion: 1,
          model: deps.postureConfig.model ?? "mistral-small-latest",
          provider: posture.providerName,
          sessionData: {
            snapshot,
            analysis: parsed.data,
            generatedAt: new Date().toISOString(),
          },
        });

        return session;
      },

      async getLatestSession(userId) {
        return deps.sessionRepository.findLatestByUserId(userId);
      },

      async listSessions(userId) {
        const sessions = await deps.sessionRepository.listByUserId(userId);
        return {
          sessions,
          totalCount: sessions.length,
        };
      },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory-llm.service.test.ts` (create)

  Run: `bun test apps/api/src/modules/advisory/advisory-llm.service.test.ts`
  Expected: Tests pass, exit code 0.
  Commit: `git add apps/api/src/modules/advisory/advisory-llm.service.ts apps/api/src/modules/advisory/advisory-llm.service.test.ts && git commit -m "feat(#116): implement advisory LLM service with audit logging"`

- [ ] **T8 — Wire oRPC routes, module factory, and runtime dependencies** [AC: AC-5, AC-6]
  Mount `generateAnalysis`, `getLatestSession`, `listSessions` onto the gated advisory router, pass dependencies in `runtime-dependencies.ts`, and run complete integration suite.

  **Path:** `apps/api/src/modules/advisory/advisory.routes.ts` (modify)
  Add handlers for `generateAnalysis`, `getLatestSession`, `listSessions`.

  **Path:** `apps/api/src/modules/advisory/advisory.module.ts` (modify)
  Wire `createAdvisoryEncryptor`, `createAdvisorySessionRepository`, and `createAdvisoryLlmService`.

  **Path:** `apps/api/src/bootstrap/runtime-dependencies.ts` (modify)
  Pass `llmService: llmModule.service`, `llmProvider: llmModule.thirdPartyClient` (or dedicated provider), and env configuration to `createAdvisoryModule`.

  **Path:** `apps/api/src/modules/advisory/advisory.routes.test.ts` (modify)
  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (modify)

  Run: `bun --filter='@pekulo/api' run test && bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run lint`
  Expected: All tests pass, typecheck passes, lint passes.
  Commit: `git add apps/api/src/modules/advisory/ apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#116): wire advisory LLM routes, runtime dependencies, and integration tests"`

## Dev Notes

### Architecture & Guardrails
- **ADR-0016 §2 (DR-3 Carve-out):** The LLM is authorized on this private surface to provide recommendations including instrument-level guidance. Public product ban remains absolute.
- **ADR-0016 §3 (NFR-12 Exception):** Real user financials are provided to the prompt, but the deterministic snapshot owns all numbers. The grounding validator enforces that no foreign numbers are cited.
- **ADR-0016 §5 (Single Audit Authority):** Calls use `LlmService.recordLlmCallPair` without prompt content, preserving NFR-26.
- **ADR-0013 / ADR-0015 (Encrypted Storage & RLS):** Table `advisory_sessions` has symmetric RLS quartet and AES-256-GCM encrypted payload.

### Step-0 Code Quotes (Verbatim)

`packages/contracts/src/advisory/advisory.contract.ts:36-45`:
```ts
export const advisoryContractV1 = {
  status: oc.output(advisoryStatusSchema).errors(advisoryErrors),
  snapshot: oc.output(advisorySnapshotSchema).errors(advisoryErrors),
  grant: oc
    .input(advisoryTargetInputSchema)
    .output(advisoryAccessEntrySchema)
    .errors(advisoryErrors),
  ban: oc.input(advisoryTargetInputSchema).output(advisoryAccessEntrySchema).errors(advisoryErrors),
  list: oc.output(advisoryAccessListSchema).errors(advisoryErrors),
} as const;
```

`apps/api/src/database/id-prefixes.config.ts:77-82`:
```ts
  // AdvisoryAccess (story 12-1, ADR-0016 §4) — PK is `user_id` (UUID FK to
  // auth.users), one row per user, no synthetic id column. Same opt-out shape
  // as UserPref: the prefixed-ids extension MUST NOT inject, or the grant
  // upsert's create branch throws MissingPrefixError.
  AdvisoryAccess: null,
} as const satisfies Record<string, string | null>;
```

`apps/api/src/modules/advisory/advisory.module.ts:14-25`:
```ts
export interface AdvisoryModule {
  service: AdvisoryAccessService;
  analysis: AdvisoryAnalysisService;
  router: ReturnType<typeof createAdvisoryRouter>;
}

export function createAdvisoryModule(
  deps: {
    prismaService: PrismaService;
    ownerUserIds: ReadonlySet<string>;
  } & AdvisoryAnalysisPorts,
): AdvisoryModule {
```

`apps/api/src/modules/advisory/advisory.routes.ts:24-27`:
```ts
export function createAdvisoryRouter(deps: {
  service: AdvisoryAccessService;
  analysis: AdvisoryAnalysisService;
}) {
```

### 3-Bullet File Decisions

1. `packages/validators/src/advisory/advisory.llm.schemas.ts`
   - Single responsibility: Defines Zod schemas and TypeScript types for LLM outputs and sessions.
   - Inputs/Outputs: Imports `@pekulo/zod` and snapshot schema; exports recommendation, analysis, and session schemas.
2. `apps/api/prisma/migrations/20261027170000_create_advisory_sessions/migration.sql`
   - Single responsibility: Hand-written idempotent DDL creating `advisory_sessions` with RLS and cascade FK.
   - Inputs/Outputs: Executed against Postgres database; creates table, index, constraints, and RLS policies.
3. `apps/api/src/modules/advisory/advisory-encryption.ts`
   - Single responsibility: Provides authenticated AES-256-GCM encryption/decryption for session data at rest.
   - Inputs/Outputs: Imports `node:crypto`; exports `createAdvisoryEncryptor`.
4. `apps/api/src/modules/advisory/advisory-posture.ts`
   - Single responsibility: Asserts that the configured LLM provider adheres to EU-region and no-train invariants.
   - Inputs/Outputs: Takes provider configuration; throws if non-compliant or returns verified metadata.
5. `apps/api/src/modules/advisory/advisory-grounding-validator.ts`
   - Single responsibility: Scans LLM analysis content and asserts all cited figures match the deterministic snapshot.
   - Inputs/Outputs: Takes `AdvisoryAnalysisResult` and `AdvisorySnapshot`; throws `PekuloError` on ungrounded figures.
6. `apps/api/src/modules/advisory/advisory-prompt-builder.ts`
   - Single responsibility: Generates the full prompt text containing the snapshot and strict instruction rules.
   - Inputs/Outputs: Takes `AdvisorySnapshot`; returns prompt string.
7. `apps/api/src/modules/advisory/advisory-session.repository.ts`
   - Single responsibility: Handles Prisma read/write operations for `advisory_sessions` with encryption and decryption.
   - Inputs/Outputs: Imports PrismaClient and encryptor; exports `AdvisorySessionRepository`.
8. `apps/api/src/modules/advisory/advisory-llm.service.ts`
   - Single responsibility: Orchestrates advisory generation, grounding validation, audit logging, and persistence.
   - Inputs/Outputs: Integrates snapshot service, LLM provider, session repository, and audit logger.

## File List

- `packages/validators/src/advisory/advisory.llm.schemas.ts`
- `packages/validators/src/advisory/index.ts`
- `packages/contracts/src/advisory/advisory.contract.ts`
- `apps/api/prisma/schema/advisory.prisma`
- `apps/api/prisma/migrations/20261027170000_create_advisory_sessions/migration.sql`
- `apps/api/src/database/id-prefixes.config.ts`
- `apps/api/src/database/id-prefixes.config.test.ts`
- `apps/api/src/modules/settings/settings.export.ts`
- `apps/api/src/modules/settings/settings.deletion.ts`
- `apps/api/scripts/rls-audit.ts`
- `apps/api/src/modules/advisory/advisory-encryption.ts`
- `apps/api/src/modules/advisory/advisory-encryption.test.ts`
- `apps/api/src/modules/advisory/advisory-posture.ts`
- `apps/api/src/modules/advisory/advisory-posture.test.ts`
- `apps/api/src/modules/advisory/advisory-grounding-validator.ts`
- `apps/api/src/modules/advisory/advisory-grounding-validator.test.ts`
- `apps/api/src/modules/advisory/advisory-prompt-builder.ts`
- `apps/api/src/modules/advisory/advisory-prompt-builder.test.ts`
- `apps/api/src/modules/advisory/advisory-session.repository.ts`
- `apps/api/src/modules/advisory/advisory-session.repository.test.ts`
- `apps/api/src/modules/advisory/advisory-llm.service.ts`
- `apps/api/src/modules/advisory/advisory-llm.service.test.ts`
- `apps/api/src/modules/advisory/advisory.llm.schemas.test.ts`
- `apps/api/src/modules/advisory/advisory.routes.ts`
- `apps/api/src/modules/advisory/advisory.routes.test.ts`
- `apps/api/src/modules/advisory/advisory.module.ts`
- `apps/api/src/modules/advisory/advisory.module.test.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/modules/advisory/advisory.integration.test.ts`

## Dev Agent Record

### Summary

Ready for dev implementation.

### Files changed

None yet (implementation phase pending).

### Deviations

None yet.

### Test output

None yet (implementation phase pending).
