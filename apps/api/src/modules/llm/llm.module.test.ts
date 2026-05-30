// bun:test — whole-module wired (story 6-1, AC-1/AC-4 + per-user isolation).
// DEVIATION from the story draft: the repo has no `test/helpers/test-db.ts`
// Postgres harness — every *.module.test.ts wires a duck-typed fake Prisma
// (see bank-aggregator/transactions). We follow that pattern. The userId-guard
// isolation asserted here is the single-layer defence on the api service-role
// path (ADR-0013); RLS-policy coverage is verified separately by db:rls-audit.
import { expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import type { JwtVerifier } from "../../platform/security";
import type { Env } from "../../config/env";
import { createLlmModule } from "./llm.module";

interface Row {
  id: string;
  userId: string;
  callId: string;
  phase: string;
  route: string;
  labelHash: string;
  latencyMs: number | null;
  outcome: string | null;
  occurredAt: Date;
  createdAt: Date;
}

// In-memory Prisma fake: llm_call_log rows honour `where: { userId }` so the
// repository's tenant-isolation clause is exercised end-to-end.
function makeFakeDb(): PrismaService {
  const rows: Row[] = [];
  let n = 0;
  let clock = 0;
  const client = {
    llmCallLog: {
      create: async ({ data }: { data: Omit<Row, "id" | "occurredAt" | "createdAt"> }) => {
        const at = new Date(Date.UTC(2026, 4, 30, 0, 0, clock++));
        rows.push({ ...data, id: `llm_${++n}`, occurredAt: at, createdAt: at });
        return undefined;
      },
      findMany: async ({ where }: { where: { userId: string; createdAt?: { gte?: Date } } }) =>
        rows
          .filter((r) => r.userId === where.userId)
          .filter((r) => !where.createdAt?.gte || r.createdAt >= where.createdAt.gte)
          .sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
          ),
    },
    llmOptIn: {
      findUnique: async () => null,
    },
  };
  return { client } as unknown as PrismaService;
}

const fakeJwt = { verify: async () => ({ sub: "u-a", email: null }) } as unknown as JwtVerifier;
const fakeEnv = {} as unknown as Env;

test("route writes an intent row for the owning user (AC-1)", async () => {
  const mod = createLlmModule({ prismaService: makeFakeDb(), env: fakeEnv, jwtVerifier: fakeJwt });
  const decision = await mod.service.route({
    userId: "user-a",
    clientCapabilities: { iosFoundationModels: false },
    prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
  });
  expect(decision.route).toBe("ollama");

  const calls = await mod.repository.listRecentByUser("user-a", new Date(0));
  expect(calls.length).toBe(1);
  expect(calls[0]!.phase).toBe("intent");
  expect(calls[0]!.route).toBe("ollama");
});

test("recordLlmCall rows are isolated per user (userId guard)", async () => {
  const mod = createLlmModule({ prismaService: makeFakeDb(), env: fakeEnv, jwtVerifier: fakeJwt });
  await mod.service.recordLlmCall("user-a", {
    phase: "outcome",
    callId: "cz",
    route: "ollama",
    labelHash: "h",
    latencyMs: 100,
    outcome: "success",
  });
  const bRows = await mod.repository.listRecentByUser("user-b", new Date(0));
  expect(bRows.length).toBe(0);
});
