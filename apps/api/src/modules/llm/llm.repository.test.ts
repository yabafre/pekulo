// bun:test — LLM repository (story 6-1). Uses a mock Prisma client to assert
// the create payload shape + the opt-in default. NOTE: there is no Postgres
// test-DB harness in this repo, so llm.module.test.ts also runs against a fake
// Prisma and asserts the `where:{userId}` guard (the single-layer api defence,
// ADR-0013) — NOT real RLS. RLS-policy coverage is verified separately by
// `db:rls-audit` (llm_call_log: 2 / llm_opt_in: 4).
import { test, expect, mock } from "bun:test";
import type { PrismaService } from "../../database";
import { createLlmRepository } from "./llm.repository";

function makePrismaMock(optInRow: { thirdParty: boolean } | null) {
  const create = mock(async (_args: unknown) => undefined);
  const findUnique = mock(async () => optInRow);
  const $transaction = mock(async (ops: Promise<unknown>[]) => Promise.all(ops));
  const findMany = mock(async (_args: unknown) => [
    {
      id: "llm_abc123",
      callId: "c1",
      userId: "u1",
      phase: "outcome",
      route: "ollama",
      labelHash: "h",
      latencyMs: 240,
      outcome: "success",
      occurredAt: new Date("2026-06-01T08:00:00.000Z"),
      createdAt: new Date("2026-06-01T08:00:00.000Z"),
    },
  ]);
  const prismaService = {
    client: { llmCallLog: { create, findMany }, llmOptIn: { findUnique }, $transaction },
  } as unknown as PrismaService;
  return { prismaService, create, findUnique, $transaction, findMany };
}

test("recordCallEvent writes an intent row with null latency/outcome", async () => {
  const { prismaService, create } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  await repo.recordCallEvent("u1", {
    phase: "intent",
    callId: "c1",
    route: "ollama",
    labelHash: "abcd1234",
  });
  expect(create).toHaveBeenCalledTimes(1);
  const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
  expect(arg.data).toMatchObject({
    userId: "u1",
    callId: "c1",
    phase: "intent",
    route: "ollama",
    labelHash: "abcd1234",
    latencyMs: null,
    outcome: null,
  });
});

test("recordCallEvent writes an outcome row with latency + outcome", async () => {
  const { prismaService, create } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  await repo.recordCallEvent("u1", {
    phase: "outcome",
    callId: "c1",
    route: "ollama",
    labelHash: "abcd1234",
    latencyMs: 240,
    outcome: "success",
  });
  const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
  expect(arg.data).toMatchObject({ phase: "outcome", latencyMs: 240, outcome: "success" });
});

test("recordCallEvents writes every event through a single $transaction (atomic pair)", async () => {
  const { prismaService, create, $transaction } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  await repo.recordCallEvents("u1", [
    { phase: "intent", callId: "c1", route: "foundation_models", labelHash: "h" },
    {
      phase: "outcome",
      callId: "c1",
      route: "foundation_models",
      labelHash: "h",
      latencyMs: 480,
      outcome: "success",
    },
  ]);
  expect($transaction).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledTimes(2);
});

test("isThirdPartyOptedIn defaults to false when no row exists", async () => {
  const { prismaService } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  expect(await repo.isThirdPartyOptedIn("u1")).toBe(false);
});

test("isThirdPartyOptedIn returns the stored flag", async () => {
  const { prismaService } = makePrismaMock({ thirdParty: true });
  const repo = createLlmRepository({ prismaService });
  expect(await repo.isThirdPartyOptedIn("u1")).toBe(true);
});

test("listRecentOutcomesByUser filters to phase outcome + the since window, keyset-ordered", async () => {
  const { prismaService, findMany } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  const since = new Date("2026-03-05T00:00:00.000Z");
  const entries = await repo.listRecentOutcomesByUser("u1", since);
  expect(findMany).toHaveBeenCalledTimes(1);
  const arg = findMany.mock.calls[0]![0] as {
    where: { userId: string; phase: string; createdAt: { gte: Date } };
    orderBy: unknown;
    take: number;
  };
  expect(arg.where).toMatchObject({ userId: "u1", phase: "outcome" });
  // AC-3: the `createdAt >= since` predicate IS the 90-day exclusion contract at
  // unit scope. Actual >90-day row exclusion is Prisma's to enforce (no Postgres
  // test-DB harness here — see file header; covered by the DB-backed db:rls-audit).
  expect(arg.where.createdAt.gte).toBe(since);
  expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  expect(arg.take).toBe(200);
  expect(entries[0]).toMatchObject({ route: "ollama", latencyMs: 240, outcome: "success" });
});

test("listRecentOutcomesByUser maps rows to the DTO without any prompt field (NFR-26)", async () => {
  const { prismaService } = makePrismaMock(null);
  const repo = createLlmRepository({ prismaService });
  const [entry] = await repo.listRecentOutcomesByUser("u1", new Date(0));
  expect(Object.keys(entry!).sort()).toEqual(
    ["callId", "id", "latencyMs", "occurredAt", "outcome", "phase", "route"].sort(),
  );
  expect(entry).not.toHaveProperty("labelHash");
});
