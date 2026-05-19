// Whole-module wired flow on fake Prisma. Verifies the create → recordLot →
// getDerived → close → list path lands end-to-end through the factory.

import { describe, expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import { createHoldingsModule } from "./holdings.module";

const userA = "00000000-0000-0000-0000-00000000000a";
const accA = "acc_aaaaaaaaaaaaaaaaaaaaa";

function dec(n: number): { toNumber: () => number } {
  return { toNumber: () => n };
}

function makeFakePrismaService(): PrismaService {
  const accounts = new Map([[accA, { id: accA, userId: userA }]]);
  const holdings = new Map<string, Record<string, unknown>>();
  const lots = new Map<string, Record<string, unknown>>();
  let h = 0;
  let l = 0;
  const client = {
    account: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const row = accounts.get(where.id);
        return row && row.userId === where.userId ? row : null;
      },
    },
    holding: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h += 1;
        const id = "hld_" + String(h).padStart(21, "x");
        const row = {
          id,
          ...data,
          quantity: dec(data.quantity as number),
          avgCost: dec(data.avgCost as number),
          lastPrice: dec(0),
          lastPriceAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: null,
        };
        holdings.set(id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const row = holdings.get(where.id);
        return row && (row.userId as string) === where.userId ? row : null;
      },
      findMany: async ({ where }: { where: { userId: string; closedAt?: null } }) => {
        const rows = Array.from(holdings.values()).filter(
          (r) => (r.userId as string) === where.userId,
        );
        if (where.closedAt === null) {
          return rows.filter((r) => (r.closedAt as Date | null) === null);
        }
        return rows;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; userId: string; closedAt?: null };
        data: Record<string, unknown>;
      }) => {
        const row = holdings.get(where.id);
        if (!row || (row.userId as string) !== where.userId) return { count: 0 };
        if (where.closedAt === null && (row.closedAt as Date | null) !== null) {
          return { count: 0 };
        }
        holdings.set(where.id, { ...row, ...data });
        return { count: 1 };
      },
    },
    holdingLot: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        l += 1;
        const id = "lot_" + String(l).padStart(21, "x");
        const row = {
          id,
          ...data,
          quantity: dec(data.quantity as number),
          priceUnit: dec(data.priceUnit as number),
          fees: dec((data.fees as number) ?? 0),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        lots.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { holdingId: string; userId: string } }) => {
        return Array.from(lots.values()).filter(
          (r) =>
            (r.holdingId as string) === where.holdingId && (r.userId as string) === where.userId,
        );
      },
    },
  };
  // $transaction shim — invokes the callback with the same in-memory client.
  // Repository.recordLot uses $transaction to keep parent-probe + lot-insert atomic.
  const withTx = Object.assign(client, {
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => fn(client),
  });
  return { client: withTx } as unknown as PrismaService;
}

// Story 3-2/3-3 — env stub for the provider deps. All vars are optional;
// setting them undefined exercises the "not-configured" / fallback paths at
// the client factories without forcing the module to construct against real
// provider HTTP endpoints.
type ModuleEnv = Parameters<typeof createHoldingsModule>[0]["env"];

function makeDeps(
  envOverride: Partial<ModuleEnv> = {},
): Parameters<typeof createHoldingsModule>[0] {
  return {
    prismaService: makeFakePrismaService(),
    env: {
      PRICES_SERVICE_URL: undefined,
      PRICES_SERVICE_TOKEN: undefined,
      TWELVE_DATA_API_KEY: undefined,
      FRANKFURTER_BASE_URL: undefined,
      ...envOverride,
    },
  };
}

describe("holdings.module", () => {
  test("create → recordLot → getDerived → close → list", async () => {
    const mod = createHoldingsModule(makeDeps());

    const created = await mod.service.create(userA, {
      accountId: accA,
      ticker: "CW8",
      kind: "etf",
      currency: "EUR",
      label: "Amundi MSCI World",
      quantity: 0,
      avgCost: 0,
    });
    expect(created.id).toMatch(/^hld_/);

    await mod.service.recordLot(userA, {
      holdingId: created.id,
      type: "buy",
      occurredOn: new Date("2026-01-01"),
      quantity: 10,
      priceUnit: 80,
      fees: 1,
    });

    const derived = await mod.service.getDerived(userA, { id: created.id });
    expect(derived.source).toBe("lots");
    expect(derived.quantity).toBe(10);
    expect(derived.avgCost).toBe(80.1);

    const closeOut = await mod.service.close(userA, { id: created.id });
    expect(closeOut).toEqual({ ok: true });

    const activeOnly = await mod.service.list(userA, { includeClosed: false });
    expect(activeOnly.length).toBe(0);

    const all = await mod.service.list(userA, { includeClosed: true });
    expect(all.length).toBe(1);
    expect(all[0]!.closedAt).not.toBeNull();
  });
});

// AC-7 (verbatim from docs/stories/3-3-portfolio-fx.md):
//   loadEnv() succeeds with env.FRANKFURTER_BASE_URL === undefined AND
//   frankfurterClient.isConfigured === false. When FRANKFURTER_BASE_URL is set,
//   frankfurterClient.isConfigured === true.
describe("frankfurterClient wiring", () => {
  test("isConfigured=false when FRANKFURTER_BASE_URL is undefined", () => {
    const { frankfurterClient } = createHoldingsModule(makeDeps());
    expect(frankfurterClient.isConfigured).toBe(false);
  });

  test("isConfigured=true when FRANKFURTER_BASE_URL is set", () => {
    const { frankfurterClient } = createHoldingsModule(
      makeDeps({ FRANKFURTER_BASE_URL: "https://api.frankfurter.app" }),
    );
    expect(frankfurterClient.isConfigured).toBe(true);
  });
});
