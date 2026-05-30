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
  const prismaService = {
    client: { llmCallLog: { create }, llmOptIn: { findUnique }, $transaction },
  } as unknown as PrismaService;
  return { prismaService, create, findUnique, $transaction };
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
