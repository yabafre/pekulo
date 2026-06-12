// apps/api/src/modules/dashboard/fx-rates-source.test.ts
// Last-known-good FX caching layer: live → stale → unavailable, never silent 1:1.
import { describe, expect, test } from "bun:test";
import { createFxRatesReader } from "./fx-rates-source";
import type { FxRates } from "@pekulo/validators";

const RATES_A: FxRates = {
  base: "EUR",
  date: "2026-06-04",
  rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
};
const RATES_B: FxRates = {
  base: "EUR",
  date: "2026-06-05",
  rates: { EUR: 1, USD: 1.1, GBP: 0.86, CHF: 0.96 },
};

describe("createFxRatesReader", () => {
  test("success → source 'live' and the fresh rates", async () => {
    const reader = createFxRatesReader({ getRates: async () => RATES_A });
    const out = await reader.read("EUR");
    expect(out.source).toBe("live");
    expect(out.rates).toEqual(RATES_A);
  });

  test("failure AFTER a prior success → source 'stale' with the last-known-good rates", async () => {
    let succeed = true;
    const reader = createFxRatesReader({
      getRates: async () => {
        if (succeed) return RATES_A;
        throw new Error("frankfurter down");
      },
    });

    const first = await reader.read("EUR");
    expect(first.source).toBe("live");
    expect(first.rates).toEqual(RATES_A);

    succeed = false;
    const second = await reader.read("EUR");
    expect(second.source).toBe("stale");
    // The cached rates are served — NEVER a 1:1 fallback.
    expect(second.rates).toEqual(RATES_A);
  });

  test("a later success overwrites the cached last-known-good", async () => {
    let current: FxRates | Error = RATES_A;
    const reader = createFxRatesReader({
      getRates: async () => {
        if (current instanceof Error) throw current;
        return current;
      },
    });

    await reader.read("EUR"); // caches A
    current = RATES_B;
    const live = await reader.read("EUR"); // caches B
    expect(live.source).toBe("live");
    expect(live.rates).toEqual(RATES_B);

    current = new Error("down");
    const stale = await reader.read("EUR");
    expect(stale.source).toBe("stale");
    expect(stale.rates).toEqual(RATES_B); // most recent live snapshot, not A
  });

  test("cold start + failure → source 'unavailable', rates null, AND a structured warn log", async () => {
    const logs: string[] = [];
    const reader = createFxRatesReader({
      getRates: async () => {
        throw new Error("frankfurter down");
      },
      warn: (m) => logs.push(m),
    });

    const out = await reader.read("EUR");
    expect(out.source).toBe("unavailable");
    expect(out.rates).toBeNull();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("[fx]");
    expect(logs[0]).toContain("unavailable");
    expect(logs[0]).toContain("base=EUR");
    expect(logs[0]).toContain("frankfurter down");
  });

  test("read never throws even when getRates rejects", async () => {
    const reader = createFxRatesReader({
      getRates: async () => {
        throw new Error("boom");
      },
      warn: () => {},
    });
    // Should resolve, not reject.
    await expect(reader.read("EUR")).resolves.toMatchObject({ source: "unavailable" });
  });
});
