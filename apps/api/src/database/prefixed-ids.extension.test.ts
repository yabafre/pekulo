// prefixed-ids.extension.test.ts — integration test for the Prisma extension
// wiring (review F7 — Marcus anti-pattern #5: integration test as afterthought).
//
// We do NOT spin up Postgres here. The extension's contract is to delegate to a
// `query` callback (the underlying Prisma operation) after rewriting `args.data`
// or `args.create` via injectPrefixedId. We exercise that contract by stubbing
// `query` and asserting (a) the rewritten args reach `query`, (b) the extension's
// own guards (object-shape, upsert.update id reject) fire.
//
// `prefixedIdsHandlers` is the exported handler bag; `prefixedIdsExtension` (the
// Prisma.defineExtension wrapper) consumes the same handlers, so testing the
// handlers proves the wiring path that runs at request time.

import { describe, expect, it } from "bun:test";
import { prefixedIdsHandlers } from "./prefixed-ids.extension";

describe("prefixedIdsHandlers", () => {
  it("create — injects prefixed id, then forwards to query(args)", async () => {
    let receivedArgs: { data: unknown } | undefined;
    const query = async (args: { data: unknown }) => {
      receivedArgs = args;
      return { fake: "row" };
    };
    const out = await prefixedIdsHandlers.create({ model: "Account", args: { data: { userId: "u" } }, query });
    expect(out).toEqual({ fake: "row" });
    expect(receivedArgs).toBeDefined();
    expect((receivedArgs!.data as { id: string }).id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
    expect((receivedArgs!.data as { userId: string }).userId).toBe("u");
  });

  it("create — preserves explicit id (idempotence path through the extension)", async () => {
    let receivedArgs: { data: unknown } | undefined;
    const query = async (args: { data: unknown }) => {
      receivedArgs = args;
      return null;
    };
    await prefixedIdsHandlers.create({ model: "Account", args: { data: { id: "acc_explicit", userId: "u" } }, query });
    expect((receivedArgs!.data as { id: string }).id).toBe("acc_explicit");
  });

  it("create — throws TypeError on non-object data with model in message (review F8)", async () => {
    const query = async () => null;
    await expect(
      prefixedIdsHandlers.create({ model: "Account", args: { data: null as unknown }, query }),
    ).rejects.toThrow(/create for model "Account" is not an object \(got null\)/);
  });

  it("createMany — array branch — injects an id in every row, in order", async () => {
    let receivedArgs: { data: unknown } | undefined;
    const query = async (args: { data: unknown }) => {
      receivedArgs = args;
      return { count: 0 };
    };
    await prefixedIdsHandlers.createMany({ model: "Holding", args: { data: [{ userId: "u" }, { userId: "u2" }] }, query });
    const rows = receivedArgs!.data as Array<{ id: string; userId: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toMatch(/^hld_[0-9A-Za-z]{21}$/);
    expect(rows[1]!.id).toMatch(/^hld_[0-9A-Za-z]{21}$/);
    expect(rows[0]!.userId).toBe("u");
    expect(rows[1]!.userId).toBe("u2");
  });

  it("createMany — object branch — injects an id when data is a single object", async () => {
    let receivedArgs: { data: unknown } | undefined;
    const query = async (args: { data: unknown }) => {
      receivedArgs = args;
      return { count: 1 };
    };
    await prefixedIdsHandlers.createMany({ model: "Transaction", args: { data: { userId: "u", amount: 10 } }, query });
    expect((receivedArgs!.data as { id: string }).id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
  });

  it("createMany — throws TypeError on non-object row with model + index in message (review F8)", async () => {
    const query = async () => null;
    await expect(
      prefixedIdsHandlers.createMany({ model: "Holding", args: { data: [{ userId: "u" }, null] as unknown[] }, query }),
    ).rejects.toThrow(/createMany row 1 for model "Holding"/);
  });

  it("createManyAndReturn — array branch — same wiring as createMany", async () => {
    let receivedArgs: { data: unknown } | undefined;
    const query = async (args: { data: unknown }) => {
      receivedArgs = args;
      return [];
    };
    await prefixedIdsHandlers.createManyAndReturn({ model: "Account", args: { data: [{ userId: "u" }] }, query });
    const rows = receivedArgs!.data as Array<{ id: string }>;
    expect(rows[0]!.id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
  });

  it("upsert — injects an id into args.create, leaves args.update untouched", async () => {
    let receivedArgs: { create: unknown; update: unknown } | undefined;
    const query = async (args: { create: unknown; update: unknown }) => {
      receivedArgs = args;
      return null;
    };
    await prefixedIdsHandlers.upsert({
      model: "Account",
      args: { create: { userId: "u" }, update: { label: "renamed" } },
      query,
    });
    expect((receivedArgs!.create as { id: string }).id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
    expect(receivedArgs!.update).toEqual({ label: "renamed" });
  });

  it("upsert — rejects args.update.id (PK clobber attempt) with model name in message (review F9)", async () => {
    const query = async () => null;
    await expect(
      prefixedIdsHandlers.upsert({
        model: "Account",
        args: { create: { userId: "u" }, update: { id: "wrong_id" } },
        query,
      }),
    ).rejects.toThrow(/upsert\.update for model "Account" must not contain id/);
  });
});
