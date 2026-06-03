// apps/api/src/modules/transactions/transactions-autoapply.test.ts
// bun:test — story 6-7 (FR-33 amended). Repository-level: applySuggestedCategory
// query shape (category set + suggested_* kept + the 'autre' guard) and the
// source field surfaced on listAutreWithoutAttempt. Fake Prisma (no Postgres
// harness — 6-1 precedent; RLS coverage stays in db:rls-audit).

import { describe, expect, mock, test } from "bun:test";
import { createTransactionsRepository } from "./transactions.repository";
import type { ExtendedPrismaClient } from "../../database";

describe("applySuggestedCategory (6-7)", () => {
  test("sets category = suggestion, keeps suggested_*, guards category='autre'", async () => {
    const updateMany = mock(async () => ({ count: 1 }));
    const repo = createTransactionsRepository({
      client: { transaction: { updateMany } } as unknown as ExtendedPrismaClient,
    });
    const out = await repo.applySuggestedCategory("u_a", "tx_aaaaaaaaaaaaaaaaaaaaa", {
      category: "courses",
      confidence: 0.82,
      route: "ollama",
    });
    expect(out).toEqual({ applied: true });
    const call = (updateMany.mock.calls[0]! as unknown[])[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({
      id: "tx_aaaaaaaaaaaaaaaaaaaaa",
      userId: "u_a",
      category: "autre",
    });
    expect(call.data.category).toBe("courses");
    expect(call.data.suggestedCategory).toBe("courses");
    expect(call.data.suggestedConfidence).toBe(0.82);
    expect(call.data.suggestedRoute).toBe("ollama");
    expect(call.data.suggestedAttemptedAt).toBeInstanceOf(Date);
  });

  test("returns { applied: false } when the guard matched no row (user set a category meanwhile)", async () => {
    const updateMany = mock(async () => ({ count: 0 }));
    const repo = createTransactionsRepository({
      client: { transaction: { updateMany } } as unknown as ExtendedPrismaClient,
    });
    const out = await repo.applySuggestedCategory("u_a", "tx_bbbbbbbbbbbbbbbbbbbbb", {
      category: "loyer",
      confidence: 0.9,
      route: "ollama",
    });
    expect(out).toEqual({ applied: false });
  });
});

describe("listAutreWithoutAttempt surfaces source (6-7)", () => {
  test("maps the row's source onto the candidate (defaults to 'manual' when absent)", async () => {
    const findMany = mock(async () => [
      {
        id: "tx_ccccccccccccccccccccc",
        userId: "u_a",
        accountId: "acc_a",
        occurredOn: new Date("2026-05-15T00:00:00Z"),
        label: "Carrefour",
        amount: { toNumber: () => 12 },
        type: "outflow",
        category: "autre",
        isImprevu: false,
        notes: null,
        transferPairId: null,
        suggestedCategory: null,
        suggestedConfidence: null,
        suggestedRoute: null,
        suggestedAt: null,
        suggestedAttemptedAt: null,
        source: "csv",
        createdAt: new Date("2026-05-15T00:00:00Z"),
      },
    ]);
    const repo = createTransactionsRepository({
      client: { transaction: { findMany } } as unknown as ExtendedPrismaClient,
    });
    const rows = await repo.listAutreWithoutAttempt("u_a", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("csv");
    expect(rows[0]!.category).toBe("autre");
  });
});
