// apps/api/src/modules/dashboard/dashboard.module.test.ts
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardModule } from "./dashboard.module";

describe("createDashboardModule", () => {
  test("returns a service + router wired over the ports", async () => {
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
    });
    expect(typeof mod.service.getOverview).toBe("function");
    expect(mod.router.getOverview).toBeDefined();
    const out = await mod.service.getOverview("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(out.totalWealthEur).toBe(0);
    expect(out.compass).toBeNull();
  });
});
