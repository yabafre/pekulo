// apps/api/src/modules/dashboard/dashboard.module.test.ts
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import type { PrismaService } from "../../database";
import { createDashboardModule } from "./dashboard.module";

describe("createDashboardModule", () => {
  test("wires the overview + layout halves onto one router", () => {
    // The layout half only needs prismaService.client at request time; the
    // structural smoke test below never invokes a handler, so a bare stub is
    // enough. getOverview's numeric behaviour is covered by the service +
    // integration suites.
    const mod = createDashboardModule({
      listAccounts: async () => [],
      listHoldings: async () => [],
      resolveQuote: async () => {
        throw new Error("no holdings");
      },
      getRates: async () => ({
        base: "EUR",
        date: "2026-06-04",
        rates: { EUR: 1, USD: 1, GBP: 1, CHF: 1 },
      }),
      getTotalEquity: async () => ({ totalEquityEur: 0 }),
      getCompass: async () => null,
      computeProgress,
      prismaService: { client: {} } as unknown as PrismaService,
    });
    expect(mod.router.getOverview).toBeDefined();
    expect(mod.router.getLayout).toBeDefined();
    expect(mod.router.saveLayout).toBeDefined();
  });
});
