import { describe, expect, test } from "bun:test";
import { ConfigError, loadEnv } from "./env";

const BASE = {
  DATABASE_URL: "postgres://x:y@localhost:5432/db",
  SUPABASE_JWT_SECRET: "x".repeat(32),
  SUPABASE_URL: "https://example.supabase.co",
} as const;

describe("loadEnv", () => {
  test("parses minimal env with no price-chain vars", () => {
    const env = loadEnv(BASE);
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
    expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
  });

  test("parses env with all three price-chain vars set", () => {
    const env = loadEnv({
      ...BASE,
      PRICES_SERVICE_URL: "https://prices.internal:8000",
      PRICES_SERVICE_TOKEN: "tok-abc",
      TWELVE_DATA_API_KEY: "td-key",
    });
    expect(env.PRICES_SERVICE_URL).toBe("https://prices.internal:8000");
    expect(env.PRICES_SERVICE_TOKEN).toBe("tok-abc");
    expect(env.TWELVE_DATA_API_KEY).toBe("td-key");
  });

  test("rejects malformed PRICES_SERVICE_URL", () => {
    expect(() => loadEnv({ ...BASE, PRICES_SERVICE_URL: "not-a-url" })).toThrow(ConfigError);
  });

  test("treats empty-string env vars as absent (KEY= in .env)", () => {
    const env = loadEnv({
      ...BASE,
      PRICES_SERVICE_URL: "",
      PRICES_SERVICE_TOKEN: "",
      TWELVE_DATA_API_KEY: "",
      FRANKFURTER_BASE_URL: "",
    });
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
    expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
  });

  // AC-7 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given an `apps/api` process with only the existing required env vars set
  //   AND FRANKFURTER_BASE_URL unset, loadEnv succeeds with
  //   env.FRANKFURTER_BASE_URL === undefined. When FRANKFURTER_BASE_URL=""
  //   the loader treats it as absent. When set, env.FRANKFURTER_BASE_URL
  //   round-trips. No default URL is hard-coded.
  test("parses env with FRANKFURTER_BASE_URL set", () => {
    const env = loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "https://api.frankfurter.app" });
    expect(env.FRANKFURTER_BASE_URL).toBe("https://api.frankfurter.app");
  });

  test("rejects malformed FRANKFURTER_BASE_URL", () => {
    expect(() => loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "not-a-url" })).toThrow(ConfigError);
  });
});
